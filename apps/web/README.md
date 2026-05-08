# Web App (`apps/web`)

SvelteKit frontend for the workout dashboard.

## Stack

- SvelteKit + TypeScript
- Tailwind CSS
- Cloudflare adapter (`@sveltejs/adapter-cloudflare`)

## Current Routes

- `/`
- `/dashboard`
- `/settings`
- `/auth/login`

`/dashboard` is currently powered by mock data only.

## Commands

From repo root:

```bash
pnpm --filter web dev
pnpm --filter web check
pnpm --filter web build
```

If Cloudflare worker configuration changes, regenerate types:

```bash
pnpm --filter web gen
```
