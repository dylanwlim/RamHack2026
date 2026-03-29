import { createRequire } from "module";
import { NextResponse } from "next/server";

const require = createRequire(import.meta.url);
const {
  getQueryInput,
  searchDrugApplications,
  searchNdcRecords,
  searchRecallsForCandidate,
  searchShortagesForCandidate,
} = require("../../../api/_lib/openfda");
const {
  buildCandidateContexts,
  buildDrugIntelligencePayload,
  buildSearchPhrases,
} = require("../../../api/_lib/openfda-normalize");
const { buildDemoDrugIntelligencePayload } = require("../../../lib/medications/demo");
const { resolveMedicationOption } = require("../../../lib/medications/index-store");

export const dynamic = "force-dynamic";

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

    const resolvedMedication = await resolveMedicationOption(input.query);
    if (resolvedMedication?.source === "demo") {
      const demoPayload = buildDemoDrugIntelligencePayload(input.query);

      if (demoPayload) {
        return NextResponse.json(demoPayload);
      }
    }

    const searchPhrases = buildSearchPhrases(input.query);

    const [ndcPayload, approvalsPayload] = await Promise.all([
      searchNdcRecords(searchPhrases),
      searchDrugApplications(searchPhrases),
    ]);

    const candidates = buildCandidateContexts(input.query, ndcPayload, approvalsPayload);
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

    const shortageResultsById = Object.fromEntries(
      evidencePairs.map((entry) => [entry.id, entry.shortages]),
    );
    const recallResultsById = Object.fromEntries(
      evidencePairs.map((entry) => [entry.id, entry.recalls]),
    );

    return NextResponse.json(
      buildDrugIntelligencePayload({
        query: input.query,
        ndcPayload,
        approvalsPayload,
        shortageResultsById,
        recallResultsById,
      }),
    );
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
