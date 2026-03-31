import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const require = createRequire(import.meta.url);
const {
  SEARCH_ASSET_DIR,
  SEARCH_ASSET_VERSION,
  SEARCH_BUCKETS_DIR,
  SEARCH_MANIFEST_PATH,
  SNAPSHOT_PATH,
  buildMedicationSearchAssets,
  getMedicationSnapshot,
} = require("../../lib/medications/index-store");

const PUBLIC_SNAPSHOT_PATH = path.join(
  process.cwd(),
  "public",
  "medication-index.snapshot.json.gz",
);

function parseArgs(argv) {
  return {
    force: argv.includes("--force"),
  };
}

function serializeGzipJson(payload) {
  return zlib.gzipSync(`${JSON.stringify(payload)}\n`);
}

async function writeGzipJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, serializeGzipJson(payload));
}

async function syncPublicSnapshot() {
  await fs.mkdir(path.dirname(PUBLIC_SNAPSHOT_PATH), { recursive: true });
  await fs.copyFile(SNAPSHOT_PATH, PUBLIC_SNAPSHOT_PATH);
  return PUBLIC_SNAPSHOT_PATH;
}

async function shouldRebuild(force) {
  if (force) {
    return true;
  }

  try {
    const [snapshotStat, manifestStat, manifestRaw] = await Promise.all([
      fs.stat(SNAPSHOT_PATH),
      fs.stat(SEARCH_MANIFEST_PATH),
      fs.readFile(SEARCH_MANIFEST_PATH),
    ]);
    const manifest = JSON.parse(zlib.gunzipSync(manifestRaw).toString("utf8"));

    return (
      manifest.version !== SEARCH_ASSET_VERSION ||
      manifestStat.mtimeMs < snapshotStat.mtimeMs
    );
  } catch (error) {
    if (error?.code === "ENOENT") {
      return true;
    }

    throw error;
  }
}

async function main() {
  const { force } = parseArgs(process.argv.slice(2));
  const rebuild = await shouldRebuild(force);
  const publicSnapshotPath = await syncPublicSnapshot();

  if (!rebuild) {
    console.log(
      JSON.stringify(
        {
          skipped: true,
          reason: "Medication runtime assets are already up to date.",
          manifestPath: SEARCH_MANIFEST_PATH,
          publicSnapshotPath,
        },
        null,
        2,
      ),
    );
    return;
  }

  const snapshot = await getMedicationSnapshot();
  const { manifest, buckets } = buildMedicationSearchAssets(snapshot);

  await fs.rm(SEARCH_ASSET_DIR, { recursive: true, force: true });
  await fs.mkdir(SEARCH_BUCKETS_DIR, { recursive: true });
  await writeGzipJson(SEARCH_MANIFEST_PATH, manifest);
  await Promise.all(
    Object.entries(buckets).map(([bucketKey, options]) =>
      writeGzipJson(path.join(SEARCH_BUCKETS_DIR, `${bucketKey}.json.gz`), options),
    ),
  );

  console.log(
    JSON.stringify(
      {
        skipped: false,
        publicSnapshotPath,
        manifestPath: SEARCH_MANIFEST_PATH,
        bucketCount: Object.keys(buckets).length,
        featuredCount: manifest.featuredResults.length,
        generatedAt: manifest.generatedAt,
        datasetLastUpdated: manifest.source.datasetLastUpdated,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
