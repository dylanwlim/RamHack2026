# PharmaPath

Static hackathon MVP for RamHack 2026. PharmaPath helps patients compare nearby
pharmacies by medication, dosage, formulation, and stock status so they can
find a likely fill faster.

## Local preview

Run any static file server from the repo root, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages deployment

This repo includes `.github/workflows/deploy.yml` for GitHub Pages deployment
through GitHub Actions.

Required GitHub setting:

- `Settings -> Pages -> Build and deployment -> Source` should be set to
  `GitHub Actions`

Expected live URL:

- `https://ivyz0.github.io/RamHack2026/`

## Files of note

- `index.html`: landing page and demo experience
- `styles.css`: full visual styling and responsive layout
- `script.js`: mock inventory data and search/filter behavior
- `.github/workflows/deploy.yml`: GitHub Pages deployment workflow
