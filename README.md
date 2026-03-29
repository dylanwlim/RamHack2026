# PharmaPath

PharmaPath is a tool that helps patients and prescribers understand medication access friction — combining nearby pharmacy discovery with FDA-sourced drug intelligence in one workflow.

## What it does

**Pharmacy Finder** — search a medication and location to see nearby pharmacies ranked by call priority, alongside an FDA-derived access signal (easy / moderate / difficult / unavailable) that reflects shortage, recall, discontinuation, and manufacturer context.

**Medication Lookup** — get a deeper intelligence view: shortage evidence, recall details, formulation alternatives, manufacturer history, approval status, and a plain-language takeaway for clinical decision-making.

**What it does not do** — PharmaPath does not claim live shelf inventory. It uses Google Places for pharmacy discovery and FDA datasets for access signals. It is explicit about this distinction throughout the UI.

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
- **Google Places / Geocoding API** — nearby pharmacy discovery (server-side)
- **openFDA** — NDC listings, shortages, Drugs@FDA approvals, enforcement/recalls (server-side)

### Key source directories

```
app/                    Next.js pages and API routes
  api/
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
| `GOOGLE_API_KEY` | Yes | Server-side — pharmacy search and geocoding |
| `OPENFDA_API_KEY` | Recommended | Server-side — higher FDA rate limits |
| `FDA_API_KEY` | No | Legacy fallback (still supported; not needed if `OPENFDA_API_KEY` is set) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | No | Analytics only |

On Vercel, set all of the above in both Preview and Production environments.

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

## Medication index

The medication autocomplete is backed by a normalized snapshot of the openFDA NDC bulk dataset. It supports brand name, generic name, ingredient, strength, dosage form, route, and NDC matching.

- **Rebuild locally:** `npm run sync:medications`
- **Checked-in snapshot:** `data/medication-index.snapshot.json.gz`
- **Automated refresh:** GitHub Actions workflow (`.github/workflows/medication-index-sync.yml`) runs daily at 07:17 UTC, commits any snapshot changes to `main`, and Vercel picks up the deploy automatically.

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
  "radiusMiles": 5,
  "sortBy": "best_match",
  "onlyOpenNow": false
}
```

Returns: resolved location, ranked nearby pharmacies from Google Places, medication-specific call guidance, and a disclaimer that inventory is not live verified.

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
