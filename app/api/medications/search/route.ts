import { createRequire } from "node:module";
import { NextResponse } from "next/server";

const require = createRequire(import.meta.url);
const {
  DEFAULT_SEARCH_LIMIT,
  searchMedicationOptions,
} = require("../../../../lib/medications/index-store");

export const dynamic = "force-dynamic";

function sanitizeText(value: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const assetBaseUrl = new URL(request.url).origin;
    const query = sanitizeText(searchParams.get("q") || searchParams.get("query"));
    const exact = ["1", "true", "yes"].includes(
      sanitizeText(searchParams.get("exact")).toLowerCase(),
    );
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || DEFAULT_SEARCH_LIMIT, 1),
      12,
    );
    const { results, snapshot } = await searchMedicationOptions(query, {
      limit,
      exact,
      assetBaseUrl,
    });

    return NextResponse.json({
      status: "ok",
      query,
      exact,
      results,
      dataFreshness: {
        generatedAt: snapshot.generatedAt,
        datasetLastUpdated: snapshot.source.datasetLastUpdated,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to search the medication index right now.",
      },
      { status: 500 },
    );
  }
}
