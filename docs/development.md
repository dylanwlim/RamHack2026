# Development

Public documentation should help people understand the product first, while private operational details stay outside the repo.

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

- If you need access to the full local experience, request the required credentials from a maintainer.
- Release operations and credential handling are maintained outside the public docs set.
