import fs from "node:fs";
import path from "node:path";

if (process.argv.includes("dev")) {
  void import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) =>
    initOpenNextCloudflareForDev(),
  );
}

function loadPublicWranglerVars() {
  try {
    const wranglerConfigPath = path.join(process.cwd(), "wrangler.jsonc");
    const wranglerConfig = JSON.parse(fs.readFileSync(wranglerConfigPath, "utf8"));
    const configVars = wranglerConfig?.vars ?? {};

    return Object.fromEntries(
      Object.entries(configVars)
        .filter(([key, value]) => key.startsWith("NEXT_PUBLIC_") && typeof value === "string")
        .map(([key, value]) => [key, process.env[key] ?? value]),
    );
  } catch {
    return {};
  }
}

const publicWranglerVars = loadPublicWranglerVars();

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  env: publicWranglerVars,
};

export default nextConfig;
