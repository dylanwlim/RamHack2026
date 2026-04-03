"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const zlib = require("node:zlib");
const {
  deriveWorkflowCategory,
  normalizeIdentifier,
  normalizeMedicationText,
} = require("./normalize");
const { getDemoMedicationOptions } = require("./demo");
const {
  buildMedicationQueryLabel,
  inferMatchedStrength,
  sortStrengthValues,
  toStrengthOption,
} = require("./selection");

const SNAPSHOT_PATH = path.join(process.cwd(), "data", "medication-index.snapshot.json.gz");
const SNAPSHOT_ASSET_PATH = "/medication-index.snapshot.json.gz";
const SEARCH_ASSET_DIR = path.join(process.cwd(), "public", "medication-search");
const SEARCH_BUCKETS_DIR = path.join(SEARCH_ASSET_DIR, "buckets");
const SEARCH_MANIFEST_PATH = path.join(SEARCH_ASSET_DIR, "manifest.json.gz");
const SEARCH_MANIFEST_ASSET_PATH = "/medication-search/manifest.json.gz";
const SEARCH_BUCKET_ASSET_PREFIX = "/medication-search/buckets";
const SEARCH_ASSET_VERSION = 2;
const SEARCH_PRIMARY_PREFIX_LENGTH = 2;
const SEARCH_EXPANSION_PREFIX_LENGTH = 4;
const SEARCH_EXPANSION_BUCKET_LIMIT = 24;
const SEARCH_SPECIAL_TOKENS = new Set(["er", "ir", "xr", "dr", "odt"]);
const DEFAULT_SEARCH_LIMIT = 8;

const snapshotPromises = new Map();
const searchManifestPromises = new Map();
const searchBucketPromises = new Map();
const preparedIndexPromises = new Map();

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      values
        .map((value) => sanitizeText(value))
        .filter(Boolean),
    ),
  );
}

function titleCase(value) {
  return sanitizeText(value)
    .split(/\s+/)
    .map((token) =>
      token
        .split("-")
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
        .join("-"),
    )
    .join(" ");
}

function parseGzipJson(raw) {
  return JSON.parse(zlib.gunzipSync(raw).toString("utf8"));
}

function loadGzipJsonFromDisk(filePath) {
  return fs.readFile(filePath).then((raw) => parseGzipJson(raw));
}

async function loadGzipJsonFromAsset(assetPath, assetBaseUrl) {
  const response = await fetch(new URL(assetPath, assetBaseUrl));

  if (!response.ok) {
    const error = new Error(`Unable to load medication asset (${response.status}).`);
    error.statusCode = response.status;
    throw error;
  }

  const raw = Buffer.from(await response.arrayBuffer());
  return parseGzipJson(raw);
}

async function loadGzipJsonFromAssetBinding(assetPath) {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const assets = getCloudflareContext().env.ASSETS;

  if (!assets) {
    throw new Error("Cloudflare ASSETS binding is unavailable.");
  }

  const response = await assets.fetch(new URL(`http://assets.local${assetPath}`));

  if (!response.ok) {
    const error = new Error(`Unable to load medication asset from Cloudflare (${response.status}).`);
    error.statusCode = response.status;
    throw error;
  }

  const raw = Buffer.from(await response.arrayBuffer());
  return parseGzipJson(raw);
}

function loadSnapshotFromDisk() {
  return loadGzipJsonFromDisk(SNAPSHOT_PATH);
}

async function loadSnapshotFromAsset(assetBaseUrl) {
  return loadGzipJsonFromAsset(SNAPSHOT_ASSET_PATH, assetBaseUrl);
}

async function loadSnapshotFromAssetBinding() {
  return loadGzipJsonFromAssetBinding(SNAPSHOT_ASSET_PATH);
}

function getCacheKey(assetBaseUrl) {
  return sanitizeText(assetBaseUrl) || "__disk__";
}

function getMedicationSnapshot({ assetBaseUrl } = {}) {
  const cacheKey = getCacheKey(assetBaseUrl);

  if (!snapshotPromises.has(cacheKey)) {
    const nextPromise = loadSnapshotFromDisk()
      .catch((error) => {
        if (error?.code !== "ENOENT") {
          throw error;
        }

        return loadSnapshotFromAssetBinding().catch((assetBindingError) => {
          if (!assetBaseUrl) {
            throw assetBindingError;
          }

          return loadSnapshotFromAsset(assetBaseUrl);
        });
      })
      .catch((error) => {
        snapshotPromises.delete(cacheKey);
        throw error;
      });

    snapshotPromises.set(cacheKey, nextPromise);
  }

  return snapshotPromises.get(cacheKey);
}

function buildSearchText(option) {
  return normalizeMedicationText(
    [
      option.label,
      option.description,
      option.canonicalName,
      option.canonicalLabel,
      option.formulation,
      option.formulationShortLabel,
      option.dosageForm,
      option.route,
      ...(option.aliases || []),
      ...(option.strengths || []).map((strength) => strength.value),
      ...(option.normalizedIdentifiers || []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function inferFormulationMetadata(dosageForm) {
  const normalizedForm = normalizeMedicationText(dosageForm);

  if (!normalizedForm) {
    return {
      key: "standard",
      label: null,
      shortLabel: null,
    };
  }

  if (normalizedForm.includes("extended-release")) {
    return {
      key: "extended_release",
      label: "Extended release",
      shortLabel: "ER",
    };
  }

  if (normalizedForm.includes("delayed-release")) {
    return {
      key: "delayed_release",
      label: "Delayed release",
      shortLabel: "DR",
    };
  }

  if (normalizedForm.includes("immediate-release")) {
    return {
      key: "immediate_release",
      label: "Immediate release",
      shortLabel: "IR",
    };
  }

  if (normalizedForm.includes("orally-disintegrating")) {
    return {
      key: "orally_disintegrating",
      label: "Orally disintegrating",
      shortLabel: "ODT",
    };
  }

  return {
    key: "standard",
    label: null,
    shortLabel: null,
  };
}

function simplifyDosageFormLabel(dosageForm) {
  const normalizedForm = normalizeMedicationText(dosageForm);

  if (!normalizedForm) {
    return null;
  }

  if (normalizedForm.includes("extended-release") && normalizedForm.includes("capsule")) {
    return "capsule";
  }

  if (normalizedForm.includes("extended-release") && normalizedForm.includes("tablet")) {
    return "tablet";
  }

  if (normalizedForm.includes("immediate-release") && normalizedForm.includes("tablet")) {
    return "tablet";
  }

  if (normalizedForm.includes("immediate-release") && normalizedForm.includes("capsule")) {
    return "capsule";
  }

  if (normalizedForm.includes("film-coated tablet")) {
    return "tablet";
  }

  if (normalizedForm.includes("tablet, chewable")) {
    return "chewable tablet";
  }

  if (normalizedForm.includes("powder, for suspension")) {
    return "suspension";
  }

  if (normalizedForm.includes("injection")) {
    return "injection";
  }

  return dosageForm;
}

function pickPrimaryName(record) {
  const brandName = sanitizeText(record.brandName);
  const genericName = sanitizeText(record.genericName);

  if (
    brandName &&
    (!genericName || normalizeMedicationText(brandName) !== normalizeMedicationText(genericName))
  ) {
    return brandName;
  }

  return genericName || brandName || sanitizeText(record.displayLabel);
}

function createOpenFdaGroup(record) {
  const canonicalName = pickPrimaryName(record);
  const formulation = inferFormulationMetadata(record.dosageForm);
  const simplifiedDosageForm = simplifyDosageFormLabel(record.dosageForm);

  return {
    key: [
      normalizeMedicationText(canonicalName),
      formulation.key,
      normalizeMedicationText(simplifiedDosageForm),
      normalizeMedicationText(record.route),
    ].join("|"),
    familyKey: normalizeMedicationText(canonicalName),
    canonicalName,
    genericNames: new Set(),
    strengths: new Set(),
    dosageForms: new Set(),
    simplifiedDosageForms: new Set(),
    routes: new Set(),
    identifiers: new Set(),
    aliases: new Set(),
    recordIds: new Set(),
    source: "openfda",
    formulationKey: formulation.key,
    formulationLabel: formulation.label,
    formulationShortLabel: formulation.shortLabel,
    productCount: 0,
    workflowCategory: record.workflowCategory,
    badge: record.badge || undefined,
  };
}

function buildOptionDescription(group, strengthCount) {
  const genericName =
    Array.from(group.genericNames).find(
      (value) => normalizeMedicationText(value) !== normalizeMedicationText(group.canonicalName),
    ) || null;
  const presentationLabel = [group.primaryRoute, group.primaryDosageForm].filter(Boolean).join(" ");
  const strengthLabel = strengthCount === 1 ? "1 strength" : `${strengthCount} strengths`;

  return [genericName, presentationLabel || null, strengthLabel].filter(Boolean).join(" • ");
}

function buildOpenFdaMedicationOptions(records, featuredMedicationIds) {
  const groups = new Map();

  records.forEach((record) => {
    const groupKey = createOpenFdaGroup(record).key;
    const group = groups.get(groupKey) || createOpenFdaGroup(record);

    if (record.genericName) {
      group.genericNames.add(record.genericName);
    }

    if (record.strength) {
      group.strengths.add(record.strength);
    }

    if (record.dosageForm) {
      group.dosageForms.add(record.dosageForm);
    }

    const simplifiedDosageForm = simplifyDosageFormLabel(record.dosageForm);
    if (simplifiedDosageForm) {
      group.simplifiedDosageForms.add(simplifiedDosageForm);
    }

    if (record.route) {
      group.routes.add(record.route);
    }

    (record.ndcProductCodes || []).forEach((identifier) => {
      group.identifiers.add(identifier);
      group.identifiers.add(normalizeIdentifier(identifier));
    });

    [
      record.displayLabel,
      record.brandName,
      record.genericName,
      ...(record.aliases || []),
    ]
      .filter(Boolean)
      .forEach((alias) => group.aliases.add(alias));

    group.recordIds.add(record.id);
    group.productCount += Number(record.productCount || 0);
    groups.set(groupKey, group);
  });

  const groupedByFamily = Array.from(groups.values()).reduce((map, group) => {
    const familyGroups = map.get(group.familyKey) || [];
    familyGroups.push(group);
    map.set(group.familyKey, familyGroups);
    return map;
  }, new Map());

  Array.from(groups.values()).forEach((group) => {
    const familyGroups = groupedByFamily.get(group.familyKey) || [group];
    const familyHasModifiedRelease = familyGroups.some(
      (candidate) => candidate.formulationKey !== "standard",
    );
    const isStandardSolidOral =
      group.formulationKey === "standard" &&
      Array.from(group.simplifiedDosageForms).some((value) =>
        /tablet|capsule/.test(normalizeMedicationText(value)),
      );

    group.primaryDosageForm =
      Array.from(group.dosageForms)[0] || Array.from(group.simplifiedDosageForms)[0] || null;
    group.primaryRoute = Array.from(group.routes)[0] || null;
    group.formulationShortLabel =
      group.formulationShortLabel || (familyHasModifiedRelease && isStandardSolidOral ? "IR" : null);
    group.formulationLabel =
      group.formulationLabel || (familyHasModifiedRelease && isStandardSolidOral ? "Immediate release" : null);

    let label = group.canonicalName;

    if (familyGroups.length > 1) {
      if (group.formulationShortLabel) {
        label = `${group.canonicalName} ${group.formulationShortLabel}`;
      } else if (group.primaryDosageForm) {
        label = `${group.canonicalName} ${titleCase(group.primaryDosageForm)}`;
      } else if (group.primaryRoute) {
        label = `${group.canonicalName} ${group.primaryRoute}`;
      }
    }

    group.optionLabel = label;
    group.queryBaseLabel =
      familyGroups.length > 1 && group.formulationShortLabel ? group.canonicalName : group.canonicalName;
    group.queryDosageForm = familyGroups.length > 1 ? group.primaryDosageForm : null;
  });

  const collisionMap = Array.from(groups.values()).reduce((map, group) => {
    const normalizedLabel = normalizeMedicationText(group.optionLabel);
    const collisions = map.get(normalizedLabel) || [];
    collisions.push(group);
    map.set(normalizedLabel, collisions);
    return map;
  }, new Map());

  Array.from(collisionMap.values()).forEach((collisions) => {
    if (collisions.length <= 1) {
      return;
    }

    collisions.forEach((group) => {
      if (group.primaryDosageForm) {
        group.optionLabel = `${group.optionLabel} ${titleCase(group.primaryDosageForm)}`;
      } else if (group.primaryRoute) {
        group.optionLabel = `${group.optionLabel} ${group.primaryRoute}`;
      }
    });
  });

  const options = Array.from(groups.values())
    .map((group) => {
      const strengths = sortStrengthValues(Array.from(group.strengths));
      const strengthOptions = strengths.map(toStrengthOption);
      const aliases = uniqueStrings([
        group.optionLabel,
        group.canonicalName,
        ...Array.from(group.aliases),
        ...strengths.map((strength) => `${group.optionLabel} ${strength}`),
        ...strengths.map((strength) => `${group.canonicalName} ${strength}`),
      ]);

      const option = {
        id: `option-${Array.from(group.recordIds)[0]}`,
        label: group.optionLabel,
        value: group.optionLabel,
        description: buildOptionDescription(group, strengthOptions.length),
        badge: group.badge,
        source: "openfda",
        canonicalName: group.canonicalName,
        canonicalLabel: group.optionLabel,
        queryBaseLabel: group.queryBaseLabel,
        queryDosageForm: group.queryDosageForm,
        formulation: group.formulationLabel,
        formulationShortLabel: group.formulationShortLabel,
        dosageForm: group.primaryDosageForm,
        route: group.primaryRoute,
        strengths: strengthOptions,
        matchedStrength: null,
        workflowCategory: group.workflowCategory || deriveWorkflowCategory([group.canonicalName]),
        demoOnly: false,
        demoNote: null,
        simulatedUserCount: null,
        aliases,
        normalizedAliases: aliases.map(normalizeMedicationText),
        normalizedIdentifiers: Array.from(group.identifiers).filter(Boolean),
        recordIds: Array.from(group.recordIds),
        sortWeight: group.productCount,
      };

      option.searchText = buildSearchText(option);
      return option;
    })
    .sort((left, right) => {
      return (
        left.label.localeCompare(right.label) ||
        right.sortWeight - left.sortWeight ||
        left.id.localeCompare(right.id)
      );
    });

  const featuredOptionIds = featuredMedicationIds.reduce((results, recordId) => {
    const option = options.find((candidate) => candidate.recordIds.includes(recordId));
    if (option && !results.includes(option.id)) {
      results.push(option.id);
    }
    return results;
  }, []);

  return {
    options,
    featuredOptionIds,
  };
}

function prepareMedicationOption(option, normalizedQuery) {
  return {
    ...option,
    matchedStrength: inferMatchedStrength(normalizedQuery, option.strengths),
  };
}

function prepareMedicationIndex(snapshot) {
  const preparedRecords = snapshot.records.map((record) => ({
    ...record,
    normalizedLabel: normalizeMedicationText(record.displayLabel),
    normalizedAliases: (record.aliases || []).map(normalizeMedicationText),
    normalizedIdentifiers: [...(record.ndcProductCodes || []).map(normalizeIdentifier)].filter(Boolean),
  }));

  const { options: openFdaOptions, featuredOptionIds } = buildOpenFdaMedicationOptions(
    preparedRecords,
    snapshot.featuredMedicationIds || [],
  );
  const demoOptions = getDemoMedicationOptions();

  return {
    ...snapshot,
    records: preparedRecords,
    options: [...openFdaOptions, ...demoOptions],
    featuredOptionIds,
  };
}

function getPreparedMedicationIndex({ assetBaseUrl } = {}) {
  const cacheKey = getCacheKey(assetBaseUrl);

  if (!preparedIndexPromises.has(cacheKey)) {
    const nextPromise = getMedicationSnapshot({ assetBaseUrl })
      .then((snapshot) => prepareMedicationIndex(snapshot))
      .catch((error) => {
        preparedIndexPromises.delete(cacheKey);
        throw error;
      });

    preparedIndexPromises.set(cacheKey, nextPromise);
  }

  return preparedIndexPromises.get(cacheKey);
}

function compactSearchValue(value) {
  return sanitizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function toPrimaryBucketKey(value) {
  const compactValue = compactSearchValue(value);

  if (!compactValue) {
    return "__";
  }

  return compactValue.slice(0, SEARCH_PRIMARY_PREFIX_LENGTH).padEnd(SEARCH_PRIMARY_PREFIX_LENGTH, "_");
}

function toExpansionPrefix(value) {
  const compactValue = compactSearchValue(value);

  if (compactValue.length >= SEARCH_EXPANSION_PREFIX_LENGTH) {
    return compactValue.slice(0, SEARCH_EXPANSION_PREFIX_LENGTH);
  }

  if (SEARCH_SPECIAL_TOKENS.has(compactValue)) {
    return compactValue;
  }

  return null;
}

function collectOptionExpansionPrefixes(option) {
  const prefixes = new Set();

  (option.normalizedAliases || []).forEach((alias) => {
    alias
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .forEach((token) => {
        const prefix = toExpansionPrefix(token);
        if (prefix) {
          prefixes.add(prefix);
        }
      });
  });

  (option.normalizedIdentifiers || []).forEach((identifier) => {
    const prefix = toExpansionPrefix(identifier);
    if (prefix) {
      prefixes.add(prefix);
    }
  });

  return Array.from(prefixes);
}

function createSearchSnapshotMetadata(snapshot) {
  return {
    generatedAt: snapshot.generatedAt,
    source: {
      datasetLastUpdated: snapshot.source?.datasetLastUpdated || null,
    },
  };
}

function buildMedicationSearchAssets(snapshot) {
  const prepared = prepareMedicationIndex(snapshot);
  const buckets = new Map();
  const secondaryIndex = new Map();

  prepared.options.forEach((option) => {
    const primaryBucketKey = toPrimaryBucketKey(option.label || option.canonicalName);
    const bucketOptions = buckets.get(primaryBucketKey) || [];
    bucketOptions.push(option);
    buckets.set(primaryBucketKey, bucketOptions);

    collectOptionExpansionPrefixes(option).forEach((prefix) => {
      const bucketCounts = secondaryIndex.get(prefix) || new Map();
      bucketCounts.set(primaryBucketKey, (bucketCounts.get(primaryBucketKey) || 0) + 1);
      secondaryIndex.set(prefix, bucketCounts);
    });
  });

  const featuredResults = prepared.featuredOptionIds
    .map((id) => prepared.options.find((option) => option.id === id))
    .filter(Boolean)
    .map(stripInternalFields);

  return {
    manifest: {
      version: SEARCH_ASSET_VERSION,
      ...createSearchSnapshotMetadata(prepared),
      bucketKeys: Array.from(buckets.keys()).sort(),
      featuredResults,
      secondaryIndex: Object.fromEntries(
        Array.from(secondaryIndex.entries())
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([prefix, bucketCounts]) => [
            prefix,
            Array.from(bucketCounts.entries())
              .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
              .map(([bucketKey]) => bucketKey),
          ]),
      ),
    },
    buckets: Object.fromEntries(
      Array.from(buckets.entries()).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
}

function scoreAlias(alias, normalizedQuery) {
  if (!normalizedQuery) {
    return Number.POSITIVE_INFINITY;
  }

  if (alias === normalizedQuery) {
    return 0;
  }

  if (alias.startsWith(normalizedQuery)) {
    return 10 + alias.length / 1000;
  }

  if (alias.includes(` ${normalizedQuery}`)) {
    return 18;
  }

  if (alias.includes(normalizedQuery)) {
    return 26;
  }

  return Number.POSITIVE_INFINITY;
}

function scoreIdentifier(identifier, normalizedQuery, normalizedIdentifierQuery) {
  if (!normalizedIdentifierQuery) {
    return Number.POSITIVE_INFINITY;
  }

  if (identifier === normalizedIdentifierQuery) {
    return 2;
  }

  if (identifier.startsWith(normalizedIdentifierQuery)) {
    return 14;
  }

  if (normalizedQuery && identifier.includes(normalizedIdentifierQuery)) {
    return 22;
  }

  return Number.POSITIVE_INFINITY;
}

function scoreOption(option, normalizedQuery, normalizedIdentifierQuery, queryTokens, exactOnly) {
  let bestScore = Number.POSITIVE_INFINITY;

  option.normalizedAliases.forEach((alias) => {
    bestScore = Math.min(bestScore, scoreAlias(alias, normalizedQuery));
  });

  option.normalizedIdentifiers.forEach((identifier) => {
    bestScore = Math.min(
      bestScore,
      scoreIdentifier(identifier, normalizedQuery, normalizedIdentifierQuery),
    );
  });

  if (exactOnly) {
    return bestScore;
  }

  if (bestScore !== Number.POSITIVE_INFINITY) {
    return bestScore;
  }

  if (queryTokens.length && queryTokens.every((token) => option.searchText.includes(token))) {
    return 40 + queryTokens.length;
  }

  return Number.POSITIVE_INFINITY;
}

function sortScoredResults(left, right) {
  return (
    left.score - right.score ||
    (right.option.sortWeight || 0) - (left.option.sortWeight || 0) ||
    left.option.label.localeCompare(right.option.label)
  );
}

function stripInternalFields(option) {
  const {
    aliases: _aliases,
    normalizedAliases: _normalizedAliases,
    normalizedIdentifiers: _normalizedIdentifiers,
    recordIds: _recordIds,
    searchText: _searchText,
    sortWeight: _sortWeight,
    ...publicFields
  } = option;

  return publicFields;
}

function getSearchBucketDiskPath(bucketKey) {
  return path.join(SEARCH_BUCKETS_DIR, `${bucketKey}.json.gz`);
}

function getSearchBucketAssetPath(bucketKey) {
  return `${SEARCH_BUCKET_ASSET_PREFIX}/${bucketKey}.json.gz`;
}

function isMissingAssetError(error) {
  return error?.code === "ENOENT" || error?.statusCode === 404;
}

function shouldFallbackToPreparedIndex(error) {
  if (isMissingAssetError(error)) {
    return true;
  }

  if (error?.statusCode === 401 || error?.statusCode === 403) {
    return true;
  }

  const message = typeof error?.message === "string" ? error.message : "";

  return (
    message.includes("Cloudflare ASSETS binding is unavailable.") ||
    message.includes("getCloudflareContext")
  );
}

function getMedicationSearchManifest({ assetBaseUrl } = {}) {
  const cacheKey = getCacheKey(assetBaseUrl);

  if (!searchManifestPromises.has(cacheKey)) {
    const nextPromise = loadGzipJsonFromDisk(SEARCH_MANIFEST_PATH)
      .catch((error) => {
        if (!isMissingAssetError(error)) {
          throw error;
        }

        return loadGzipJsonFromAssetBinding(SEARCH_MANIFEST_ASSET_PATH).catch((assetBindingError) => {
          if (!assetBaseUrl) {
            throw assetBindingError;
          }

          return loadGzipJsonFromAsset(SEARCH_MANIFEST_ASSET_PATH, assetBaseUrl);
        });
      })
      .catch((error) => {
        searchManifestPromises.delete(cacheKey);
        throw error;
      });

    searchManifestPromises.set(cacheKey, nextPromise);
  }

  return searchManifestPromises.get(cacheKey);
}

function getMedicationSearchBucket(bucketKey, { assetBaseUrl } = {}) {
  const cacheKey = `${getCacheKey(assetBaseUrl)}:${bucketKey}`;

  if (!searchBucketPromises.has(cacheKey)) {
    const diskPath = getSearchBucketDiskPath(bucketKey);
    const assetPath = getSearchBucketAssetPath(bucketKey);
    const nextPromise = loadGzipJsonFromDisk(diskPath)
      .catch((error) => {
        if (!isMissingAssetError(error)) {
          throw error;
        }

        return loadGzipJsonFromAssetBinding(assetPath).catch((assetBindingError) => {
          if (!assetBaseUrl) {
            throw assetBindingError;
          }

          return loadGzipJsonFromAsset(assetPath, assetBaseUrl);
        });
      })
      .catch((error) => {
        if (isMissingAssetError(error)) {
          return [];
        }

        searchBucketPromises.delete(cacheKey);
        throw error;
      });

    searchBucketPromises.set(cacheKey, nextPromise);
  }

  return searchBucketPromises.get(cacheKey);
}

function collectQueryExpansionPrefixes(normalizedQuery, normalizedIdentifierQuery) {
  const prefixes = new Set();

  normalizedQuery
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .forEach((token) => {
      const prefix = toExpansionPrefix(token);
      if (prefix) {
        prefixes.add(prefix);
      }
    });

  const identifierPrefix = toExpansionPrefix(normalizedIdentifierQuery);
  if (identifierPrefix) {
    prefixes.add(identifierPrefix);
  }

  return Array.from(prefixes);
}

function dedupeOptions(options) {
  const byId = new Map();

  options.forEach((option) => {
    if (!byId.has(option.id)) {
      byId.set(option.id, option);
    }
  });

  return Array.from(byId.values());
}

function scoreMedicationCandidates(options, query, exact) {
  const normalizedQuery = normalizeMedicationText(query);
  const normalizedIdentifierQuery = normalizeIdentifier(query);
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);

  return options
    .map((option) => ({
      option: prepareMedicationOption(option, query),
      score: scoreOption(option, normalizedQuery, normalizedIdentifierQuery, queryTokens, exact),
    }))
    .filter((entry) => entry.score !== Number.POSITIVE_INFINITY)
    .sort(sortScoredResults);
}

async function searchMedicationOptionsFromPreparedIndex(
  query,
  { limit = DEFAULT_SEARCH_LIMIT, exact = false, assetBaseUrl } = {},
) {
  const prepared = await getPreparedMedicationIndex({ assetBaseUrl });
  const normalizedQuery = normalizeMedicationText(query);

  if (!normalizedQuery) {
    const featuredResults = prepared.featuredOptionIds
      .map((id) => prepared.options.find((option) => option.id === id))
      .filter(Boolean)
      .slice(0, limit)
      .map(stripInternalFields);

    return {
      results: featuredResults,
      snapshot: createSearchSnapshotMetadata(prepared),
    };
  }

  return {
    results: scoreMedicationCandidates(prepared.options, query, exact)
      .slice(0, limit)
      .map((entry) => stripInternalFields(entry.option)),
    snapshot: createSearchSnapshotMetadata(prepared),
  };
}

function searchMedicationOptions(
  query,
  { limit = DEFAULT_SEARCH_LIMIT, exact = false, assetBaseUrl } = {},
) {
  return getMedicationSearchManifest({ assetBaseUrl })
    .then(async (manifest) => {
      const normalizedQuery = normalizeMedicationText(query);

      if (!normalizedQuery) {
        return {
          results: (manifest.featuredResults || []).slice(0, limit),
          snapshot: createSearchSnapshotMetadata(manifest),
        };
      }

      const normalizedIdentifierQuery = normalizeIdentifier(query);
      const primaryBucketKey = toPrimaryBucketKey(normalizedQuery);
      const availableBucketKeys = new Set(manifest.bucketKeys || []);
      const baseOptions = availableBucketKeys.has(primaryBucketKey)
        ? await getMedicationSearchBucket(primaryBucketKey, { assetBaseUrl })
        : [];
      const expansionPrefixes = collectQueryExpansionPrefixes(normalizedQuery, normalizedIdentifierQuery);
      let candidateOptions = baseOptions;
      let scored = scoreMedicationCandidates(candidateOptions, query, exact);

      if (expansionPrefixes.length) {
        const additionalBucketKeys = [];
        const seenBucketKeys = new Set([primaryBucketKey]);

        expansionPrefixes.forEach((prefix) => {
          (manifest.secondaryIndex?.[prefix] || []).forEach((bucketKey) => {
            if (
              seenBucketKeys.has(bucketKey) ||
              additionalBucketKeys.length >= SEARCH_EXPANSION_BUCKET_LIMIT
            ) {
              return;
            }

            seenBucketKeys.add(bucketKey);
            additionalBucketKeys.push(bucketKey);
          });
        });

        if (additionalBucketKeys.length) {
          const additionalBuckets = await Promise.all(
            additionalBucketKeys.map((bucketKey) =>
              getMedicationSearchBucket(bucketKey, { assetBaseUrl }),
            ),
          );

          candidateOptions = dedupeOptions([...candidateOptions, ...additionalBuckets.flat()]);
          scored = scoreMedicationCandidates(candidateOptions, query, exact);
        }
      }

      return {
        results: scored.slice(0, limit).map((entry) => stripInternalFields(entry.option)),
        snapshot: createSearchSnapshotMetadata(manifest),
      };
    })
    .catch((error) => {
      if (!shouldFallbackToPreparedIndex(error)) {
        throw error;
      }

      return searchMedicationOptionsFromPreparedIndex(query, {
        limit,
        exact,
        assetBaseUrl,
      });
    });
}

function resolveMedicationOption(query, { assetBaseUrl } = {}) {
  return searchMedicationOptions(query, {
    assetBaseUrl,
    exact: true,
    limit: 1,
  }).then((result) => result.results[0] || null);
}

function resolveMedicationProfile(query, { assetBaseUrl } = {}) {
  return resolveMedicationOption(query, { assetBaseUrl }).then((exactOption) => {
    if (exactOption) {
      return {
        canonicalLabel: buildMedicationQueryLabel(exactOption, exactOption.matchedStrength),
        workflowCategory: exactOption.workflowCategory,
        source: exactOption.source,
        demoOnly: Boolean(exactOption.demoOnly),
        demoNote: exactOption.demoNote || null,
        simulatedUserCount: exactOption.simulatedUserCount || null,
        medicationLabel: exactOption.label,
        selectedStrength: exactOption.matchedStrength || null,
        dosageForm: exactOption.dosageForm || null,
        formulation: exactOption.formulation || null,
      };
    }

    return {
      canonicalLabel: query.trim(),
      workflowCategory: deriveWorkflowCategory([query]),
      source: "openfda",
      demoOnly: false,
      demoNote: null,
      simulatedUserCount: null,
      medicationLabel: query.trim(),
      selectedStrength: inferMatchedStrength(query, []) || null,
      dosageForm: null,
      formulation: null,
    };
  });
}

module.exports = {
  DEFAULT_SEARCH_LIMIT,
  SEARCH_ASSET_DIR,
  SEARCH_BUCKETS_DIR,
  SEARCH_ASSET_VERSION,
  SEARCH_MANIFEST_PATH,
  SNAPSHOT_PATH,
  buildMedicationSearchAssets,
  getMedicationSnapshot,
  resolveMedicationOption,
  resolveMedicationProfile,
  searchMedicationOptions,
};
