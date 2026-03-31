import { createRequire } from "module";
import { NextResponse } from "next/server";

const require = createRequire(import.meta.url);
const {
  getSearchInput,
  resolveLocationInput,
  searchNearbyPharmacies,
} = require("../../../../lib/server/pharmacy-search");
const { resolveMedicationProfile } = require("../../../../lib/medications/index-store");

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

async function handleSearch(request) {
  try {
    const body = await readRequestBody(request);
    const searchParams = request.nextUrl.searchParams;
    const assetBaseUrl = new URL(request.url).origin;
    const input = getSearchInput(
      {
        method: request.method,
        query: Object.fromEntries(searchParams.entries()),
      },
      body,
    );

    if (!input.medication) {
      return NextResponse.json({ error: "Medication is required." }, { status: 400 });
    }

    if (!input.location) {
      return NextResponse.json({ error: "Location is required." }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Nearby pharmacy search is temporarily unavailable.",
        },
        { status: 503 },
      );
    }

    const [medicationProfile, resolvedLocation] = await Promise.all([
      resolveMedicationProfile(input.medication, { assetBaseUrl }),
      resolveLocationInput(
        {
          query: input.location,
          placeId: input.locationPlaceId,
        },
        apiKey,
      ),
    ]);
    const searchResult = await searchNearbyPharmacies({
      medication: medicationProfile.canonicalLabel,
      medicationProfileKey: medicationProfile.workflowCategory,
      center: resolvedLocation.coordinates,
      radiusMiles: input.radiusMiles,
      onlyOpenNow: input.onlyOpenNow,
      apiKey,
      sortBy: input.sortBy,
    });

    return NextResponse.json({
      status: "ok",
      query: {
        medication: medicationProfile.canonicalLabel,
        location: input.location,
        location_place_id: input.locationPlaceId || resolvedLocation.place_id || null,
        radius_miles: input.radiusMiles,
        only_open_now: input.onlyOpenNow,
        sort_by: input.sortBy,
      },
      location: resolvedLocation,
      disclaimer: searchResult.disclaimer,
      medication_profile: {
        ...searchResult.medication_profile,
        source: medicationProfile.source,
        demo_only: medicationProfile.demoOnly,
        demo_note: medicationProfile.demoNote,
        simulated_user_count: medicationProfile.simulatedUserCount,
        medication_label: medicationProfile.medicationLabel,
        selected_strength: medicationProfile.selectedStrength,
        dosage_form: medicationProfile.dosageForm,
        formulation: medicationProfile.formulation,
      },
      guidance: searchResult.guidance,
      results: searchResult.results,
      recommended: searchResult.recommended,
      counts: searchResult.counts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message || "Unexpected search failure.",
      },
      { status: error.statusCode || 500 },
    );
  }
}

export async function GET(request) {
  return handleSearch(request);
}

export async function POST(request) {
  return handleSearch(request);
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
    },
  });
}
