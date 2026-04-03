import { createRequire } from "module";
import { NextResponse } from "next/server";

const require = createRequire(import.meta.url);
const { autocompleteLocationSuggestions } = require("../../../../lib/server/pharmacy-search");
const {
  createGoogleApiUnavailablePayload,
  getGoogleApiKey,
  logGoogleApiConfigurationError,
  logGoogleApiRequestError,
} = require("../../../../lib/server/google-api-config");

export const dynamic = "force-dynamic";

function parseLimit(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 8;
  }

  return Math.min(Math.max(Math.round(numericValue), 1), 10);
}

export async function GET(request) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const sessionToken = request.nextUrl.searchParams.get("sessionToken")?.trim() || "";
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

  try {
    if (!query) {
      return NextResponse.json({
        status: "ok",
        results: [],
      });
    }

    const apiKey = getGoogleApiKey();

    if (!apiKey) {
      logGoogleApiConfigurationError("locations/autocomplete", {
        queryLength: query.length,
        hasSessionToken: Boolean(sessionToken),
      });

      return NextResponse.json(
        createGoogleApiUnavailablePayload("Location suggestions are temporarily unavailable."),
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
    logGoogleApiRequestError("locations/autocomplete", error, {
      queryLength: query.length,
      hasSessionToken: Boolean(sessionToken),
      limit,
    });

    return NextResponse.json(
      {
        error: error.message || "Unable to load location suggestions right now.",
        code: error.code || undefined,
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
