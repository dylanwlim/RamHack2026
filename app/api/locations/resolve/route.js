import { createRequire } from "module";
import { NextResponse } from "next/server";

const require = createRequire(import.meta.url);
const { resolveLocationInput } = require("../../../../lib/server/pharmacy-search");

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
  try {
    const body = await readRequestBody(request);
    const query =
      (request.method === "GET"
        ? request.nextUrl.searchParams.get("q")
        : body.query || body.location) || "";
    const placeId =
      (request.method === "GET"
        ? request.nextUrl.searchParams.get("placeId")
        : body.placeId || body.locationPlaceId) || "";
    const sessionToken =
      (request.method === "GET"
        ? request.nextUrl.searchParams.get("sessionToken")
        : body.sessionToken) || "";

    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Google location resolution is not configured yet.",
        },
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
      });
    }

    return NextResponse.json(
      {
        error: error.message || "Unable to resolve that location right now.",
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
