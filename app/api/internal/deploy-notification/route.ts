import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 14;

type DeployEnvironment = "preview" | "production";

type DeployNotificationPayload = {
  environment: DeployEnvironment;
  deployedUrl: string;
  branchName: string;
  commitHash: string;
  commitMessage?: string;
  deploymentStatus: "success";
  versionId: string;
};

type DeployNotificationEnv = CloudflareEnv & {
  DISCORD_DEPLOY_WEBHOOK_URL?: string;
  VERSION_METADATA?: WorkerVersionMetadata;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function trimToUndefined(value: unknown) {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function parsePayload(rawPayload: unknown) {
  if (!rawPayload || typeof rawPayload !== "object") {
    return { error: "invalid_payload" as const };
  }

  const payload = rawPayload as Record<string, unknown>;
  const environment = trimToUndefined(payload.environment);
  const deployedUrl = trimToUndefined(payload.deployedUrl);
  const branchName = trimToUndefined(payload.branchName);
  const commitHash = trimToUndefined(payload.commitHash);
  const commitMessage = trimToUndefined(payload.commitMessage);
  const deploymentStatus = trimToUndefined(payload.deploymentStatus);
  const versionId = trimToUndefined(payload.versionId);

  if (environment !== "preview" && environment !== "production") {
    return { error: "invalid_environment" as const };
  }

  if (!deployedUrl || !branchName || !commitHash || !versionId) {
    return { error: "missing_required_fields" as const };
  }

  if (deploymentStatus !== "success") {
    return { error: "invalid_deployment_status" as const };
  }

  try {
    new URL(deployedUrl);
  } catch {
    return { error: "invalid_deployed_url" as const };
  }

  return {
    payload: {
      environment,
      deployedUrl,
      branchName,
      commitHash,
      commitMessage,
      deploymentStatus,
      versionId,
    } satisfies DeployNotificationPayload,
  };
}

function buildDiscordMessage(payload: DeployNotificationPayload) {
  const lines = [
    "**PharmaPath deploy succeeded**",
    `Environment: ${payload.environment}`,
    `Status: ${payload.deploymentStatus}`,
    `URL: ${payload.deployedUrl}`,
    `Branch: ${payload.branchName}`,
    `Commit: \`${payload.commitHash}\``,
  ];

  if (payload.commitMessage) {
    lines.push(`Message: ${truncate(payload.commitMessage, 300)}`);
  }

  return lines.join("\n");
}

function createMarkerRequest(requestUrl: string, payload: DeployNotificationPayload) {
  const markerUrl = new URL("/api/internal/deploy-notification/marker", requestUrl);
  markerUrl.searchParams.set("environment", payload.environment);
  markerUrl.searchParams.set("versionId", payload.versionId);

  return new Request(markerUrl.toString(), { method: "GET" });
}

async function getDeployNotificationCache() {
  const cacheStorage = caches as CacheStorage & { default?: Cache };
  return cacheStorage.default ?? caches.open("deploy-notifications");
}

export async function POST(request: Request) {
  let rawPayload: unknown;

  try {
    rawPayload = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "invalid_json" });
  }

  const parsed = parsePayload(rawPayload);

  if ("error" in parsed) {
    return jsonResponse(400, { ok: false, error: parsed.error });
  }

  const { payload } = parsed;
  const requestUrl = new URL(request.url);
  const deployedUrl = new URL(payload.deployedUrl);

  if (deployedUrl.origin !== requestUrl.origin) {
    return jsonResponse(400, { ok: false, error: "deployed_url_origin_mismatch" });
  }

  const { env, ctx } = await getCloudflareContext({ async: true });
  const bindings = env as DeployNotificationEnv;
  const webhookUrl = bindings.DISCORD_DEPLOY_WEBHOOK_URL ?? process.env.DISCORD_DEPLOY_WEBHOOK_URL;
  const currentVersionId = bindings.VERSION_METADATA?.id;

  if (!webhookUrl) {
    return jsonResponse(503, { ok: false, error: "missing_discord_webhook_secret" });
  }

  if (process.env.NODE_ENV === "production" && !currentVersionId) {
    return jsonResponse(503, { ok: false, error: "missing_version_metadata_binding" });
  }

  if (currentVersionId && payload.versionId !== currentVersionId) {
    return jsonResponse(409, { ok: false, error: "version_mismatch" });
  }

  const cache = await getDeployNotificationCache();
  const markerRequest = createMarkerRequest(request.url, payload);
  const cachedMarker = await cache.match(markerRequest);

  if (cachedMarker) {
    return jsonResponse(202, { ok: true, duplicate: true });
  }

  let discordResponse: Response;

  try {
    discordResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: buildDiscordMessage(payload),
        allowed_mentions: {
          parse: [],
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return jsonResponse(502, {
      ok: false,
      error: "discord_webhook_request_failed",
    });
  }

  if (!discordResponse.ok) {
    return jsonResponse(502, {
      ok: false,
      error: "discord_webhook_failed",
      status: discordResponse.status,
    });
  }

  ctx.waitUntil(
    cache.put(
      markerRequest,
      new Response("sent", {
        headers: {
          "Cache-Control": `max-age=${DEDUPE_TTL_SECONDS}`,
        },
      }),
    ).catch(() => undefined),
  );

  return jsonResponse(200, { ok: true });
}
