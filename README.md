# PharmaPath

PharmaPath helps patients and prescribers answer a practical medication-access question quickly: which pharmacy should I call first for this medication?

It combines nearby pharmacy discovery, medication-access context, and clear patient-facing guidance without presenting public data as real-time shelf inventory.

## Product

- Patient workflow: search by medication and location, review nearby pharmacies, and call with clearer context.
- Prescriber workflow: look up medication access context, shortage signals, and formulation-specific guidance.
- Product guardrail: stay explicit about what the app can infer versus what still requires direct pharmacy confirmation.

## Stack

- Next.js App Router
- Cloudflare Workers via OpenNext
- Firebase Authentication and Firestore
- Google Places and Geocoding APIs
- openFDA medication data and nightly snapshot sync

## Quick Start

1. Use Node `22.x`.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` if you need local secret overrides for `GOOGLE_API_KEY`, `OPENFDA_API_KEY`, `RESEND_API_KEY`, `CONTACT_EMAIL`, or `CONTACT_FROM_EMAIL`.
4. Run `npm run dev`.

For Cloudflare preview or deployment flows, copy `.dev.vars.example` to `.dev.vars` and populate the Worker secrets locally.

## Common Commands

- `npm run dev` starts the Next.js development server.
- `npm run lint` runs repository linting.
- `npm run typecheck` runs TypeScript validation.
- `npm test` runs the Node test suite after preparing medication runtime assets.
- `npm run build` creates the production Next.js build.
- `npm run cloudflare:build` validates the Cloudflare/OpenNext deployment build.
- `npm run medications:sync` refreshes the tracked openFDA medication snapshot.
- `npm run validate` runs the full local validation suite used by CI.

## Repository Map

- `app/`: route segments, pages, and route handlers.
- `components/`: reusable UI broken down by feature area.
- `lib/`: application logic, domain models, integrations, and server helpers.
- `data/`: canonical medication snapshot and demo medication catalog.
- `scripts/medications/`: asset preparation and snapshot maintenance scripts.
- `tests/`: Node-based regression tests for search, location, and medication data flows.
- `docs/`: architecture and deployment notes.

## Documentation

- [Architecture](./docs/architecture.md)
- [Deployment](./docs/deployment.md)
- Methodology page: [pharmapath.org/methodology](https://www.pharmapath.org/methodology)

## Public Links

- App: [pharmapath.org](https://www.pharmapath.org)
- GitHub: [dylanwlim/PharmaPath](https://github.com/dylanwlim/PharmaPath)

## Contact

- Email: [contact@pharmapath.org](mailto:contact@pharmapath.org)

## Notes

PharmaPath is an informational product experience. It is intended to support better navigation and better questions, not to replace direct pharmacy confirmation, clinical judgment, or emergency care.
