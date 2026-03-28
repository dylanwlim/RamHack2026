"use strict";

const { sendJson } = require("./_lib/pharmacy-search");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  return sendJson(res, 200, {
    status: "ok",
    google_api_configured: Boolean(process.env.GOOGLE_API_KEY),
  });
};
