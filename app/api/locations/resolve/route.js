import { createRequire } from "module";
import { NextResponse } from "next/server";

const require = createRequire(import.meta.url);
const { resolveLocationInput } = require("../../../../lib/server/pharmacy-search");
const {
  createGoogleApiUnavailablePayload,
  getGoogleApiKey,
  logGoogleApiConfigurationError,
  logGoogleApiRequestError,
} = require("../../../../lib/server/google-api-config");

export const dynamic = "force-dynamic";

async function readRequestBody(request) {
  if (request.method !== "POST") {
    return {};
  }

  try {
    return await request.json();
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

async function handleResolve(request) {
  let query = "";
  let placeId = "";
  let sessionToken = "";

  try {
    const body = await readRequestBody(request);
    query =
      (request.method === "GET"
        ? request.nextUrl.searchParams.get("q")
        : body.query || body.location) || "";
    placeId =
      (request.method === "GET"
        ? request.nextUrl.searchParams.get("placeId")
        : body.placeId || body.locationPlaceId) || "";
    sessionToken =
      (request.method === "GET"
        ? request.nextUrl.searchParams.get("sessionToken")
        : body.sessionToken) || "";

    const apiKey = getGoogleApiKey();

    if (!apiKey) {
      logGoogleApiConfigurationError("locations/resolve", {
        queryLength: query.trim().length,
        hasPlaceId: Boolean(placeId),
        hasSessionToken: Boolean(sessionToken),
      });

      return NextResponse.json(
        createGoogleApiUnavailablePayload("Location search is temporarily unavailable."),
        { status: 503 },
      );
    }

    const location = await resolveLocationInput(
      {
        query,
        placeId,
        sessionToken,
      },
      apiKey,
    );

    return NextResponse.json({
      status: "ok",
      location,
    });
  } catch (error) {
    if (error.code === "location_not_found" || error.code === "missing_location") {
      return NextResponse.json({
        status: "unresolved",
        error: error.message || "No location match was found for that search.",
        code: error.code,
      });
    }

    logGoogleApiRequestError("locations/resolve", error, {
      queryLength: query.trim().length,
      hasPlaceId: Boolean(placeId),
      hasSessionToken: Boolean(sessionToken),
    });

    return NextResponse.json(
      {
        error: error.message || "Unable to resolve that location right now.",
        code: error.code || undefined,
      },
      { status: error.statusCode || 500 },
    );
  }
}

export async function GET(request) {
  return handleResolve(request);
}

export async function POST(request) {
  return handleResolve(request);
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
    },
  });
}
