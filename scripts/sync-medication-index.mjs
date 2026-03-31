import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import zlib from "node:zlib";

import streamChain from "stream-chain";
import streamJson from "stream-json";
import pickModule from "stream-json/filters/Pick.js";
import streamArrayModule from "stream-json/streamers/StreamArray.js";

const require = createRequire(import.meta.url);
const {
  OPENFDA_NDC_BULK_URL,
  createMedicationAggregator,
} = require("../lib/medications/normalize");
const {
  SEARCH_ASSET_DIR,
  SEARCH_BUCKETS_DIR,
  SEARCH_MANIFEST_PATH,
  SNAPSHOT_PATH,
  buildMedicationSearchAssets,
} = require("../lib/medications/index-store");
const { chain } = streamChain;
const { parser } = streamJson;
const { pick } = pickModule;
const { streamArray } = streamArrayModule;

function serializeGzipJson(payload) {
  return zlib.gzipSync(`${JSON.stringify(payload)}\n`);
}

async function writeGzipJson(targetPath, payload) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, serializeGzipJson(payload));
}

async function downloadBulkZip(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/zip",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to download the openFDA NDC bulk file (${response.status}).`);
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pharmapath-medications-"));
  const targetPath = path.join(tempDir, "drug-ndc.json.zip");
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(targetPath, buffer);
  return targetPath;
}

async function parseDatasetLastUpdated(zipPath) {
  return new Promise((resolve, reject) => {
    const unzip = spawn("unzip", ["-p", zipPath, "drug-ndc-0001-of-0001.json"]);
    let buffer = "";

    unzip.on("error", reject);
    unzip.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      if (text.trim()) {
        reject(new Error(text.trim()));
      }
    });

    unzip.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const match = buffer.match(/"last_updated"\s*:\s*"([^"]+)"/);
      if (match) {
        unzip.kill("SIGTERM");
        resolve(match[1]);
      }
      if (buffer.length > 8192) {
        buffer = buffer.slice(-4096);
      }
    });

    unzip.on("close", (code, signal) => {
      if (signal === "SIGTERM") {
        return;
      }

      if (code !== 0) {
        reject(new Error("Unable to read the openFDA NDC dataset metadata."));
        return;
      }

      const match = buffer.match(/"last_updated"\s*:\s*"([^"]+)"/);
      resolve(match ? match[1] : null);
    });
  });
}

async function buildSnapshotFromZip(zipPath, sourceLastUpdated) {
  return new Promise((resolve, reject) => {
    const aggregator = createMedicationAggregator();
    const unzip = spawn("unzip", ["-p", zipPath, "drug-ndc-0001-of-0001.json"]);
    const pipeline = chain([unzip.stdout, parser(), pick({ filter: "results" }), streamArray()]);

    unzip.on("error", reject);
    unzip.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8").trim();
      if (text) {
        reject(new Error(text));
      }
    });

    pipeline.on("data", ({ value }) => {
      aggregator.ingest(value);
    });

    pipeline.on("error", reject);
    pipeline.on("end", () => {
      resolve(
        aggregator.finalize({
          sourceLastUpdated,
        }),
      );
    });
  });
}

async function main() {
  const zipPath = await downloadBulkZip(OPENFDA_NDC_BULK_URL);
  const sourceLastUpdated = await parseDatasetLastUpdated(zipPath);
  const snapshot = await buildSnapshotFromZip(zipPath, sourceLastUpdated);
  const { manifest, buckets } = buildMedicationSearchAssets(snapshot);

  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, serializeGzipJson(snapshot));
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
        snapshotPath: SNAPSHOT_PATH,
        searchManifestPath: SEARCH_MANIFEST_PATH,
        sourceLastUpdated,
        counts: snapshot.counts,
        featuredMedicationIds: snapshot.featuredMedicationIds.length,
        searchBucketCount: Object.keys(buckets).length,
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
