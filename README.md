# PharmaPath

PharmaPath is a RamHack 2026 demo that combines two layers into one medication
access workflow:

- Live nearby pharmacy discovery from Google Places
- Medication-wide access context from openFDA

The product is built for two audiences:

- Patients who need to know whether a medication may be harder than average to obtain
- Prescribers who need shortage, manufacturer, discontinuation, formulation, and recall context

The product is intentionally explicit about its limits:

- It **does not** claim live pharmacy shelf inventory
- It **does not** know whether a nearby store can fill a prescription right now
- It **does** use live Google Places data for nearby pharmacy lookup
- It **does** translate FDA listing, shortage, approval, and recall datasets into a
  signal-based access summary

## Route structure

- `/` landing page
- `/patient` patient search page
- `/patient/results?query=...&location=...` patient results page
- `/drug?query=...&id=...` drug detail page
- `/prescriber?query=...&id=...` prescriber intelligence page
- `/methodology` methodology and limitations page

## Stack

- Next.js App Router frontend: `app/`, `components/`, `lib/`
- Serverless API routes for Vercel:
  - `api/pharmacies/search.js`
  - `api/drug-intelligence.js`
  - `api/health.js`
- Google Places / Geocoding used server-side for nearby pharmacy lookup
- openFDA datasets used server-side:
  - Drug NDC
  - Drug shortages
  - Drugs@FDA
  - Drug enforcement / recalls

## Environment variables

- `GOOGLE_API_KEY`
- `OPENFDA_API_KEY`
- `FDA_API_KEY` (legacy fallback still supported by the current server code)

The nearby pharmacy route requires `GOOGLE_API_KEY`.
The openFDA routes work without an API key, but rate limits are better with one.

## Run locally

Use Vercel dev so the static pages and API routes run together:

```bash
npx vercel dev --listen 3000
```

Then open [http://localhost:3000](http://localhost:3000).

## API routes

### `POST /api/pharmacies/search`

Accepts:

```json
{
  "medication": "Adderall XR 20 mg",
  "location": "Brooklyn, NY",
  "radiusMiles": 5,
  "sortBy": "best_match",
  "onlyOpenNow": false
}
```

Returns:

- resolved search location
- ranked nearby pharmacies from Google Places
- medication-specific call guidance
- a disclaimer that inventory is not live verified

### `GET /api/health`

Returns:

```json
{
  "status": "ok",
  "data_source": "openFDA",
  "google_api_configured": true,
  "openfda_api_key_configured": false
}
```

### `GET /api/drug-intelligence?query=Adderall%20XR%2020%20mg`

Returns normalized medication intelligence including:

- `matches`
- `featured_match_id`
- `data_freshness`
- `limitations`
- `methodology_summary`

Each match contains:

- patient-facing summary copy
- prescriber-facing takeaways
- access signal label and reasoning
- shortage evidence
- recall evidence
- manufacturer, formulation, and application context

## Product framing guardrails

PharmaPath is credible when it keeps these distinctions clear:

- `Known`: nearby pharmacy discovery from Google Places, plus FDA listing, shortage,
  discontinuation, approval, and recall records
- `Inferred`: signal-based access friction summary and first-call ranking guidance
- `Unavailable`: local shelf stock, insurance outcomes, wholesaler allocations

If the UI says a medication is easier or harder to obtain, that statement should
always be framed as an estimate derived from FDA signals, not as verified retail
availability.
