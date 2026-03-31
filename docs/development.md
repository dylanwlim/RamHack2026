# Development

This document keeps local development guidance intentionally short. Public documentation should help people understand the product first, while private operational details stay outside the repo.

## Local Setup

1. Use Node `22.x`.
2. Run `npm ci`.
3. Start the app with `npm run dev`.

## Quality Checks

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Reference Data Refresh

- `npm run medications:sync` refreshes the tracked medication reference snapshot used by the app.

## Notes

- Some features depend on private configuration that is intentionally omitted from public documentation.
- If you need access to the full local experience, request the required credentials from a maintainer.
- Release operations and credential handling are maintained outside the public docs set.

## Deploy Notifications

- Cloudflare deploy notifications require the Worker secret `DISCORD_DEPLOY_WEBHOOK_URL`.
- Preview deploy notifications depend on `preview_urls` staying enabled in `wrangler.jsonc`.
- `npm run cloudflare:upload` notifies after a successful preview upload, and `npm run cloudflare:deploy` notifies after a successful production deploy. Notification failures do not fail the deploy.
