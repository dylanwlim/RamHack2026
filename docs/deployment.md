# Deployment

Production now runs on Cloudflare Workers for both `https://pharmapath.org` and `https://www.pharmapath.org`.

## Source of Truth

- Runtime and domain routing: `wrangler.jsonc`
- Worker build entrypoint: `npm run cloudflare:build`
- Worker deploy entrypoint: `npm run cloudflare:deploy`
- Public build-time Firebase config: `wrangler.jsonc` `vars` injected by `next.config.mjs`

## Local Secrets

- `NEXT_PUBLIC_FIREBASE_*` values in `wrangler.jsonc`
- Local Worker secrets live in `.dev.vars`
- Cloudflare Worker secrets: `GOOGLE_API_KEY`, `OPENFDA_API_KEY`
- Optional contact secrets: `RESEND_API_KEY`, `CONTACT_EMAIL`, `CONTACT_FROM_EMAIL`
- Without `RESEND_API_KEY`, the contact form falls back to `mailto:contact@pharmapath.org`

## Validation Commands

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run cloudflare:build`
- `npm run cloudflare:deploy`
- `curl -sSI https://pharmapath.org`
- `curl -sS https://pharmapath.org/api/health`
- `curl -sS 'https://pharmapath.org/api/medications/search?q=adderall'`
- `curl -sS 'https://pharmapath.org/api/drug-intelligence?query=adderall%20xr%2020mg'`
- `curl -sS 'https://pharmapath.org/api/pharmacies/search?medication=adderall%20xr%2020mg&location=10011'`

## Rollback

1. Check out the last known-good commit on `main`.
2. Run `npm ci`.
3. Run `npm run cloudflare:deploy`.
4. Confirm `https://pharmapath.org/api/health` returns a healthy response before considering the rollback complete.

## Operational Notes

- `npm run medications:build-assets` generates the public medication snapshot used by the Cloudflare asset fallback. The tracked snapshot source of truth remains `data/medication-index.snapshot.json.gz`.
- There is no active Vercel deployment path in the current production configuration.
