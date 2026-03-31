import { createRequire } from "module";
import { NextResponse } from "next/server";

const require = createRequire(import.meta.url);
const { autocompleteLocationSuggestions } = require("../../../../lib/server/pharmacy-search");

export const dynamic = "force-dynamic";

function parseLimit(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 8;
  }

  return Math.min(Math.max(Math.round(numericValue), 1), 10);
}

export async function GET(request) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    const sessionToken = request.nextUrl.searchParams.get("sessionToken")?.trim() || "";
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

    if (!query) {
      return NextResponse.json({
        status: "ok",
        results: [],
      });
    }

    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Google location autocomplete is not configured yet.",
        },
        { status: 503 },
      );
    }

    const results = await autocompleteLocationSuggestions(query, apiKey, {
      limit,
      sessionToken: sessionToken || undefined,
    });

    return NextResponse.json({
      status: "ok",
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message || "Unable to load location suggestions right now.",
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
