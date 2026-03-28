"use strict";

const { getOpenFdaApiKey, sendJson } = require("./_lib/openfda");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  return sendJson(res, 200, {
    status: "ok",
    data_source: "openFDA",
    google_api_configured: Boolean(process.env.GOOGLE_API_KEY),
    openfda_api_key_configured: Boolean(getOpenFdaApiKey()),
  });
};
