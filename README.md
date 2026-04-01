# PharmaPath

PharmaPath is a tool that helps patients and prescribers understand medication access friction by combining nearby pharmacy discovery with FDA-sourced drug intelligence in a single workflow.

Built for RamHack 2026!

## What it does

**Pharmacy Finder** : search for a medication and location to see nearby pharmacies ranked by call priority, alongside an FDA-derived access signal (easy / moderate / difficult / unavailable) that reflects shortages, recalls, discontinuations, and manufacturer context.

**Medication Lookup** : get a deeper intelligence view: shortage evidence, recall details, formulation alternatives, manufacturer history, approval status, and a plain-language takeaway for clinical decision-making.

**What it does not do** : PharmaPath does not claim live shelf inventory. It uses Google Places for pharmacy discovery and FDA datasets for access signals. This distinction is explicit throughout the UI.

## Crowd signal

Signed-in contributors can submit pharmacy-specific availability reports. Reports are stored in Firestore and weighted by contributor trust (based on contribution history and recency), so no single account dominates the signal. Contradictory reports reduce confidence rather than being silently averaged.

## Routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/patient` | Patient search form |
| `/patient/results?query=...&location=...` | Patient results with pharmacy list + access signal |
| `/prescriber?query=...&id=...` | Prescriber intelligence view |
| `/drug?query=...&id=...` | Drug detail page |
| `/methodology` | Data sources, signal methodology, and limitations |
| `/login` | Contributor login |
| `/register` | Contributor registration |
| `/forgot-password` | Password reset |
| `/profile` | Contributor profile |
| `/settings` | Account settings |

## Stack

- **Next.js 16** (App Router) — pages, layouts, and API routes
- **React 19** — UI
- **Tailwind CSS v4** + **Framer Motion** — styling and animation
- **Firebase Auth** — contributor accounts
- **Firestore** — contributor profiles and crowd availability reports
- **Google Places / Geocoding API** — location autocomplete, resolution, and nearby pharmacy discovery (server-side)
- **openFDA** — NDC listings, shortages, Drugs@FDA approvals, enforcement/recalls (server-side)

### Key source directories

```
app/                    Next.js pages and API routes
  api/
    locations/autocomplete/ GET — Google-backed location suggestions
    locations/resolve/      POST — canonical Google location resolution
    pharmacies/search/  POST — nearby pharmacy search
    drug-intelligence/  GET  — FDA-backed medication intelligence
    medications/search/ GET  — medication autocomplete index
    health/             GET  — service health check
  api/_lib/             Shared server-side helpers (pharmacy-search, openfda, normalize)
components/
  search/               Patient results, prescriber view, medication combobox, pharmacy form
  marketing/            Landing page sections
  auth/                 Login, register, password flows
  crowd-signal/         Crowd report card
  profile/              Profile and settings pages
lib/
  medications/          Medication index store and normalization
  content.ts            Shared copy/content
scripts/
  sync-medication-index.mjs   FDA NDC bulk snapshot builder
data/
  medication-index.snapshot.json.gz   Checked-in medication snapshot
```

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `GOOGLE_API_KEY` | Yes | Server-side — Places autocomplete, place details, nearby pharmacy search, and geocoding |
| `OPENFDA_API_KEY` | Recommended | Server-side — higher FDA rate limits |
| `FDA_API_KEY` | No | Legacy fallback (still supported; not needed if `OPENFDA_API_KEY` is set) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | No | Analytics only |
| `RESEND_API_KEY` | Optional | Required for `POST /api/contact` |
| `CONTACT_EMAIL` | Optional | Required for `POST /api/contact` |

For Cloudflare Workers previews and production deploys, set the same values on the target Worker/account. If you use a shared Cloudflare account, make sure Preview and Production both receive the required secrets/vars.

## Running locally

```bash
npm install
npm run sync:medications   # builds data/medication-index.snapshot.json.gz from FDA NDC bulk data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a production smoke check:

```bash
npm run build
npm run start
```

## Cloudflare deployment

PharmaPath is being moved onto Cloudflare Workers with OpenNext. The repo includes:

- `wrangler.jsonc` for the Worker entrypoint and bindings
- `open-next.config.ts` for the OpenNext Cloudflare adapter
- `npm run cf:build`
- `npm run cf:preview`
- `npm run cf:deploy`
- `npm run cf:whoami`

Recommended setup notes:

- Use a non-OneDrive working directory when possible. OpenNext on Windows produced file-lock issues in a OneDrive-backed path during this audit.
- `npm run cf:preview` and `npm run cf:deploy` require Cloudflare auth via Wrangler.
- The shared Cloudflare account must grant an account-scoped developer-platform role. Domain-only roles are not enough for Workers/Pages APIs.

Quick start:

```bash
npm install
npm run cf:whoami
npm run cf:build
npm run cf:preview
```

If you are targeting the shared team account, verify that `wrangler whoami` shows a Cloudflare account role with Workers access before attempting preview or deploy.

## Medication index

The medication autocomplete is backed by a normalized snapshot of the openFDA NDC bulk dataset. It supports brand name, generic name, ingredient, strength, dosage form, route, and NDC matching.

- **Rebuild locally:** `npm run sync:medications`
- **Checked-in snapshot:** `data/medication-index.snapshot.json.gz`
- **Automated refresh:** GitHub Actions workflow (`.github/workflows/medication-index-sync.yml`) runs daily at 07:17 UTC and commits any snapshot changes to `main`. Your Cloudflare deploy flow should pick that up if the repo is connected through Workers Builds, or you can deploy manually with Wrangler.

## Deploying Firestore rules and indexes

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

Or using the checked-in project alias:

```bash
npx firebase-tools deploy --project pharma-path --only firestore:rules,firestore:indexes
```

## API reference

### `POST /api/pharmacies/search`

```json
{
  "medication": "Adderall XR 20 mg",
  "location": "Brooklyn, NY",
  "locationPlaceId": "ChIJ..."
  "radiusMiles": 5,
  "sortBy": "best_match",
  "onlyOpenNow": false
}
```

Returns: a canonical resolved location, ranked nearby pharmacies from Google Places, medication-specific call guidance, and a disclaimer that inventory is not live verified.

---

### `GET /api/locations/autocomplete?q=brooklyn%20ny`

Returns live Google-backed location suggestions for freeform entries such as cities, ZIP codes, addresses, landmarks, and pharmacy names.

---

### `POST /api/locations/resolve`

```json
{
  "query": "10019"
}
```

Returns the canonical Google-resolved location structure used by the pharmacy search flow, including display label, coordinates, `place_id`, and structured address fields when available.

---

### `GET /api/drug-intelligence?query=Adderall%20XR%2020%20mg`

Returns normalized FDA medication intelligence:

- `matches` — list of candidate drugs
- `featured_match_id` — best match
- `data_freshness`, `limitations`, `methodology_summary`

Each match includes:
- Patient-facing summary and prescriber takeaways
- Access signal label and reasoning (easy / moderate / difficult / unavailable)
- Shortage evidence, recall evidence
- Manufacturer, formulation, and application context

---

### `GET /api/medications/search?q=adderall%20xr%2020%20mg`

Returns canonical medication matches from the local FDA-backed index. Supports brand names (e.g. Adderall, Wegovy) as well as generic names. Each result includes Rx/OTC badge hints and snapshot freshness metadata.

---

### `GET /api/health`

```json
{
  "status": "ok",
  "data_source": "openFDA",
  "google_api_configured": true,
  "openfda_api_key_configured": false
}
```

## Signal framing

PharmaPath is only as credible as its distinctions:

| Category | Examples |
|---|---|
| **Known** | Nearby pharmacies (Google Places), FDA listings, shortage records, discontinuation notices, approval status, recall enforcement actions |
| **Inferred** | Access friction signal, first-call ranking, contributor crowd reports |
| **Unavailable** | Live shelf stock, insurance outcomes, wholesaler allocation, real-time fill rates |

Any UI statement that a medication is easier or harder to obtain is an estimate derived from FDA signals — not verified retail availability.
