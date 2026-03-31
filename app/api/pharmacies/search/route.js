import { createRequire } from "module";
import { NextResponse } from "next/server";

const require = createRequire(import.meta.url);
const {
  getSearchInput,
  resolveLocationInput,
  searchNearbyPharmacies,
} = require("../../../../api/_lib/pharmacy-search");
const { resolveMedicationProfile } = require("../../../../lib/medications/index-store");
const {
  buildMedicationProfileFromSubmittedSearch,
  buildResolvedLocationFromSubmittedSearch,
} = require("../../../../lib/search/submitted-search-metadata");

export const dynamic = "force-dynamic";

function readMetadataValue(body, searchParams, key) {
  if (body && Object.prototype.hasOwnProperty.call(body, key)) {
    return body[key];
  }

  return searchParams.get(key);
}

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
          error: "Google pharmacy search is not configured yet.",
        },
        { status: 503 },
      );
    }

    const metadata = {
      medicationSource: readMetadataValue(body, searchParams, "medicationSource"),
      medicationWorkflowCategory: readMetadataValue(body, searchParams, "medicationWorkflowCategory"),
      medicationLabel: readMetadataValue(body, searchParams, "medicationLabel"),
      medicationSelectedStrength: readMetadataValue(body, searchParams, "medicationSelectedStrength"),
      medicationDosageForm: readMetadataValue(body, searchParams, "medicationDosageForm"),
      medicationFormulation: readMetadataValue(body, searchParams, "medicationFormulation"),
      locationLat: readMetadataValue(body, searchParams, "locationLat"),
      locationLng: readMetadataValue(body, searchParams, "locationLng"),
    };

    const submittedMedicationProfile = buildMedicationProfileFromSubmittedSearch(input, metadata);
    const submittedResolvedLocation = buildResolvedLocationFromSubmittedSearch(input, metadata);
    const [medicationProfile, resolvedLocation] = await Promise.all([
      submittedMedicationProfile
        ? Promise.resolve(submittedMedicationProfile)
        : resolveMedicationProfile(input.medication),
      submittedResolvedLocation
        ? Promise.resolve(submittedResolvedLocation)
        : resolveLocationInput(
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
