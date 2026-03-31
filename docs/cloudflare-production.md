# Cloudflare production note

Production now runs on Cloudflare Workers for both `https://pharmapath.org` and `https://www.pharmapath.org`.

Source of truth:
- Runtime and domain routing: `wrangler.jsonc`
- Worker build/deploy entrypoint: `npm run deploy`
- Public build-time Firebase config: `wrangler.jsonc` `vars` injected by `next.config.mjs`

Critical env/secrets:
- `NEXT_PUBLIC_FIREBASE_*` values in `wrangler.jsonc`
- Cloudflare Worker secrets: `GOOGLE_API_KEY`, `OPENFDA_API_KEY`
- Optional: `RESEND_API_KEY` enables inline `/contact` delivery; without it the contact form falls back to `mailto:contact@pharmapath.org`

Validation commands:
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run deploy`
- `curl -sSI https://pharmapath.org`
- `curl -sS https://pharmapath.org/api/health`
- `curl -sS 'https://pharmapath.org/api/medications/search?q=adderall'`
- `curl -sS 'https://pharmapath.org/api/drug-intelligence?query=adderall%20xr%2020mg'`
- `curl -sS 'https://pharmapath.org/api/pharmacies/search?medication=adderall%20xr%2020mg&location=10011'`

Rollback:
1. Check out commit `2d71fe927618a37bc1ba889e85b6b9729eb863c7` or another known pre-cutover Vercel-ready commit.
2. Run `npx vercel deploy --prod`.
3. Reattach `pharmapath.org` and `www.pharmapath.org` to the Vercel project.
4. Remove or disable the Cloudflare Worker routes for those hostnames so traffic no longer terminates at Workers.

Operational note:
- `VERCEL_OIDC_TOKEN` is not used by the active Cloudflare production path and should not exist in Worker secrets.
