import { createRequire } from "module";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

const require = createRequire(import.meta.url);
const {
  getQueryInput,
  searchDrugApplications,
  searchNdcRecords,
  searchRecallsForCandidate,
  searchShortagesForCandidate,
} = require("../../../lib/server/openfda");
const {
  buildCandidateContexts,
  buildDrugIntelligencePayload,
  buildSearchPhrases,
} = require("../../../lib/server/openfda-normalize");
const { buildDemoDrugIntelligencePayload } = require("../../../lib/medications/demo");

export const dynamic = "force-dynamic";

const DRUG_INTELLIGENCE_REVALIDATE_SECONDS = 10 * 60;

async function buildDrugIntelligenceResponse(query) {
  const demoPayload = buildDemoDrugIntelligencePayload(query);
  if (demoPayload) {
    return demoPayload;
  }

  const searchPhrases = buildSearchPhrases(query);

  const [ndcPayload, approvalsPayload] = await Promise.all([
    searchNdcRecords(searchPhrases),
    searchDrugApplications(searchPhrases),
  ]);

  const candidates = buildCandidateContexts(query, ndcPayload, approvalsPayload);
  const evidenceTargets = candidates.slice(0, 4);

  const evidencePairs = await Promise.all(
    evidenceTargets.map(async (candidate) => {
      const [shortagesResult, recallsResult] = await Promise.allSettled([
        searchShortagesForCandidate(candidate),
        searchRecallsForCandidate(candidate),
      ]);

      return {
        id: candidate.id,
        shortages:
          shortagesResult.status === "fulfilled"
            ? shortagesResult.value
            : { meta: { results: { total: 0, limit: 0, skip: 0 } }, results: [] },
        recalls:
          recallsResult.status === "fulfilled"
            ? recallsResult.value
            : { meta: { results: { total: 0, limit: 0, skip: 0 } }, results: [] },
      };
    }),
  );

  return buildDrugIntelligencePayload({
    query,
    ndcPayload,
    approvalsPayload,
    shortageResultsById: Object.fromEntries(
      evidencePairs.map((entry) => [entry.id, entry.shortages]),
    ),
    recallResultsById: Object.fromEntries(
      evidencePairs.map((entry) => [entry.id, entry.recalls]),
    ),
  });
}

export async function GET(request) {
  try {
    const input = getQueryInput({
      query: Object.fromEntries(request.nextUrl.searchParams.entries()),
    });

    if (!input.query) {
      return NextResponse.json(
        {
          error: "A medication query is required.",
        },
        { status: 400 },
      );
    }

    const payload = await unstable_cache(
      async () => buildDrugIntelligenceResponse(input.query),
      ["drug-intelligence", input.query.trim().toLowerCase()],
      { revalidate: DRUG_INTELLIGENCE_REVALIDATE_SECONDS },
    )();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": `public, max-age=0, s-maxage=${DRUG_INTELLIGENCE_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message || "Unable to load medication intelligence right now.",
      },
      { status: error.statusCode || 500 },
    );
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, OPTIONS",
    },
  });
}
