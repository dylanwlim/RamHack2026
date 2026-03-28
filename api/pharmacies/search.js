"use strict";

const {
  geocodeLocation,
  getSearchInput,
  readJsonBody,
  searchNearbyPharmacies,
  sendJson,
} = require("../_lib/pharmacy-search");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const body = await readJsonBody(req);
    const input = getSearchInput(req, body);

    if (!input.medication) {
      return sendJson(res, 400, { error: "Medication is required." });
    }

    if (!input.location) {
      return sendJson(res, 400, { error: "Location is required." });
    }

    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return sendJson(res, 503, {
        error: "Google pharmacy search is not configured yet.",
      });
    }

    const resolvedLocation = await geocodeLocation(input.location, apiKey);
    const searchResult = await searchNearbyPharmacies({
      medication: input.medication,
      center: resolvedLocation.coordinates,
      radiusMiles: input.radiusMiles,
      onlyOpenNow: input.onlyOpenNow,
      apiKey,
      sortBy: input.sortBy,
    });

    return sendJson(res, 200, {
      status: "ok",
      query: {
        medication: input.medication,
        location: input.location,
        radius_miles: input.radiusMiles,
        only_open_now: input.onlyOpenNow,
        sort_by: input.sortBy,
      },
      location: resolvedLocation,
      disclaimer: searchResult.disclaimer,
      results: searchResult.results,
      recommended: searchResult.recommended,
      counts: searchResult.counts,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendJson(res, statusCode, {
      error: error.message || "Unexpected search failure.",
    });
  }
};
