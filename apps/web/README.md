# Web App (`apps/web`)

SvelteKit frontend for the workout dashboard.

## Stack

- SvelteKit + TypeScript (Svelte 5 runes mode)
- Tailwind CSS v4
- Cloudflare adapter (`@sveltejs/adapter-cloudflare`)
- Supabase Auth (`@supabase/ssr`)

## Current Routes

- `/` — public home page
- `/auth/login` — login and signup form (with form actions)
- `/auth/logout` — POST endpoint for sign-out
- `/dashboard` — protected, mock stats (redirects to login if unauthenticated)
- `/settings` — protected, account and Strava connection info

## Auth

Auth is handled server-side via `@supabase/ssr`:

- `hooks.server.ts` creates a Supabase client per request and attaches `getSession` / `getUser` to `event.locals`.
- Protected routes use the `requireUser()` helper from `$lib/server/auth.ts`.
- Login/signup uses SvelteKit form actions.
- A `profiles` row is auto-created on first login/signup via `ensureProfile()`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values from `npx supabase status`:

```bash
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-status>
```

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

`/dashboard` is currently powered by mock data only.
