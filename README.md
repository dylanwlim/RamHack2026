# PharmaPath

PharmaPath is a RamHack 2026 demo for faster pharmacy search. A user enters a
medication and a location, PharmaPath finds nearby pharmacies with Google
Places, and the UI helps decide which pharmacy to contact first.

The app does **not** claim live medication inventory. It uses the medication as
search context and clearly tells the user to confirm availability directly with
the pharmacy.

## Stack

- Static frontend: `index.html`, `styles.css`, `script.js`
- Serverless API routes for Vercel: `api/health.js`,
  `api/pharmacies/search.js`
- Google APIs used server-side only:
  - Geocoding API
  - Places Nearby Search

## Required environment variable

- `GOOGLE_API_KEY`

## Run locally

Use Vercel dev so both the static frontend and API routes run together:

```bash
npx vercel env pull .env.local --environment=production --yes
npx vercel dev --listen 3000
```

Then open [http://localhost:3000](http://localhost:3000).

## API routes

### `GET /api/health`

Returns:

```json
{
  "status": "ok",
  "google_api_configured": true
}
```

If `GOOGLE_API_KEY` is missing, `google_api_configured` is `false`.

### `POST /api/pharmacies/search`

Example request:

```json
{
  "medication": "Adderall XR",
  "location": "Brooklyn, NY",
  "radiusMiles": 5,
  "sortBy": "best_match",
  "onlyOpenNow": false
}
```

Example response fields:

- `name`
- `address`
- `rating`
- `user_ratings_total`
- `open_now`
- `place_id`
- `google_maps_url`
- `coordinates`

## Product messaging guardrail

PharmaPath currently helps users:

- find nearby pharmacies faster
- preserve medication context during the search
- choose who to contact first

PharmaPath does **not** currently provide verified live medication inventory.
