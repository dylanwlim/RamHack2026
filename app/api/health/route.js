import { createRequire } from "module";
import { NextResponse } from "next/server";

const require = createRequire(import.meta.url);
const { getOpenFdaApiKey } = require("../../../lib/server/openfda");

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    data_source: "openFDA",
    google_api_configured: Boolean(process.env.GOOGLE_API_KEY),
    openfda_api_key_configured: Boolean(getOpenFdaApiKey()),
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, OPTIONS",
    },
  });
}
