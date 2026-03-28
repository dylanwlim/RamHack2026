# PharmaPath

PharmaPath is a demo-ready pharmacy access frontend for RamHack 2026. It shows
how one prescription can be routed to the most likely nearby fill by keeping
medication, dosage, formulation, and stock visibility in the same flow.

## Run locally

This is a static frontend. From the repo root, run any static server:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Demo data

- Mock inventory and preset scenarios live in `data/demo-data.js`
- Search and ranking behavior live in `services/pharmapath-client.js`
- UI rendering and interactions live in `script.js`

The current demo uses realistic mock data only. No API keys or environment
variables are required to run the frontend.

## Swapping in real integrations later

Keep the DOM/UI layer in `script.js` and replace the mock adapter in
`services/pharmapath-client.js`.

The frontend expects an adapter with methods to:

- list medications
- return dose/formulation filter options
- search prescription availability and return ranked results
- optionally expose preset demo scenarios

That lets teammates plug in live pharmacy or inventory data without rewriting
the page structure.

## Deployment notes

The site is Vercel-friendly as a static project with no build step and no
required env vars for the mock demo. Point Vercel at the repo root and deploy
the default output directly.

There is also a GitHub Pages workflow in `.github/workflows/deploy.yml` if that
path is still useful for the team.
