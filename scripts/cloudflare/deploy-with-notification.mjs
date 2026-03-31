import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const NOTIFICATION_PATH = "/api/internal/deploy-notification";

const DEPLOY_MODES = {
  preview: {
    environment: "preview",
    outputType: "version-upload",
    rawScript: "cloudflare:upload:raw",
  },
  production: {
    environment: "production",
    outputType: "deploy",
    rawScript: "cloudflare:deploy:raw",
  },
};

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    const error = new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? 1}`);
    error.exitCode = result.status ?? 1;
    throw error;
  }
}

function runCommandForOutput(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const error = new Error(result.stderr?.trim() || `${command} ${args.join(" ")} failed`);
    error.exitCode = result.status ?? 1;
    throw error;
  }

  return result.stdout.trim();
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readWranglerOutput(filePath, outputType) {
  const lines = readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const entries = lines.map((line) => JSON.parse(line));
  const matchingEntry = [...entries].reverse().find((entry) => entry.type === outputType);

  if (!matchingEntry) {
    throw new Error(`Missing Wrangler ${outputType} output entry`);
  }

  return matchingEntry;
}

function getCurrentBranchName() {
  const branchFromGit =
    runCommandForOutput("git", ["branch", "--show-current"]) ||
    runCommandForOutput("git", ["rev-parse", "--abbrev-ref", "HEAD"]);

  if (branchFromGit && branchFromGit !== "HEAD") {
    return branchFromGit;
  }

  return (
    process.env.WORKERS_CI_BRANCH ||
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME ||
    "unknown"
  );
}

function getCurrentCommitHash() {
  return runCommandForOutput("git", ["rev-parse", "HEAD"]);
}

function getCurrentCommitMessage() {
  const message = runCommandForOutput("git", ["log", "-1", "--pretty=%s"]);
  return message || undefined;
}

function normalizeUrl(urlLike) {
  const url = new URL(urlLike);
  return `${url.origin}${url.pathname === "/" ? "" : url.pathname}`;
}

export function getProductionDeployUrl() {
  try {
    const packageJson = readJsonFile(new URL("../../package.json", import.meta.url));

    if (typeof packageJson.homepage === "string" && packageJson.homepage.trim().length > 0) {
      return normalizeUrl(packageJson.homepage);
    }
  } catch {
    // Fall back to Wrangler routes below.
  }

  const wranglerConfig = readJsonFile(new URL("../../wrangler.jsonc", import.meta.url));
  const routes = Array.isArray(wranglerConfig.routes) ? wranglerConfig.routes : [];
  const preferredRoute = routes.find((route) => typeof route?.pattern === "string" && !route.pattern.includes("*"));

  if (!preferredRoute?.pattern) {
    throw new Error("Unable to resolve the production deploy URL from package.json or wrangler.jsonc");
  }

  return normalizeUrl(`https://${preferredRoute.pattern}`);
}

export function buildNotificationPayload(mode, deployment) {
  const deployedUrl =
    mode.environment === "preview"
      ? deployment.preview_alias_url || deployment.preview_url
      : getProductionDeployUrl();

  if (!deployedUrl) {
    throw new Error(`Missing deployed URL for ${mode.environment} deploy notification`);
  }

  return {
    environment: mode.environment,
    deployedUrl,
    branchName: getCurrentBranchName(),
    commitHash: getCurrentCommitHash(),
    commitMessage: getCurrentCommitMessage(),
    deploymentStatus: "success",
    versionId: deployment.version_id,
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function sendDeployNotification(payload) {
  const endpoint = new URL(NOTIFICATION_PATH, payload.deployedUrl);
  let lastError;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const responseBody = await response.json().catch(() => ({}));

        return {
          duplicate: responseBody?.duplicate === true,
          status: response.status,
        };
      }

      const responseText = await response.text().catch(() => "");
      lastError = new Error(
        `Notification endpoint returned ${response.status}${responseText ? `: ${responseText}` : ""}`,
      );
    } catch (error) {
      lastError = error;
    }

    if (attempt < 5) {
      await delay(attempt * 1000);
    }
  }

  throw lastError ?? new Error("Notification endpoint failed without an error");
}

async function main() {
  const [, , modeName, ...passthroughArgs] = process.argv;
  const mode = DEPLOY_MODES[modeName];

  if (!mode) {
    console.error("Usage: node scripts/cloudflare/deploy-with-notification.mjs <preview|production> [wrangler args]");
    process.exit(1);
  }

  const tempDirectory = mkdtempSync(join(tmpdir(), "pharmapath-deploy-"));
  const wranglerOutputFilePath = join(tempDirectory, "wrangler-output.jsonl");

  try {
    runCommand(
      npmCommand,
      ["run", mode.rawScript, ...(passthroughArgs.length > 0 ? ["--", ...passthroughArgs] : [])],
      {
        env: {
          ...process.env,
          WRANGLER_OUTPUT_FILE_PATH: wranglerOutputFilePath,
        },
      },
    );

    try {
      const deployment = readWranglerOutput(wranglerOutputFilePath, mode.outputType);

      if (!deployment.version_id) {
        console.warn("Skipping Discord deploy notification because Wrangler did not emit a version ID.");
        return;
      }

      const payload = buildNotificationPayload(mode, deployment);

      try {
        const result = await sendDeployNotification(payload);
        const resultLabel = result.duplicate ? "suppressed duplicate" : "sent";
        console.log(`Discord deploy notification ${resultLabel} for ${payload.environment} (${payload.versionId}).`);
      } catch (error) {
        console.warn(
          `Discord deploy notification failed for ${payload.environment} (${payload.versionId}). Deploy succeeded and was left intact.`,
        );

        if (error instanceof Error && error.message) {
          console.warn(error.message);
        }
      }
    } catch (error) {
      console.warn("Discord deploy notification could not be prepared. Deploy succeeded and was left intact.");

      if (error instanceof Error && error.message) {
        console.warn(error.message);
      }
    }
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

const isMainModule =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(error?.exitCode ?? 1);
  });
}
