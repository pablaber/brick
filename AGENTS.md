# AGENTS

Guidance for coding agents working in this monorepo.

## Repo Snapshot

- Package manager: `pnpm` (`9.12.3`).
- Task runner: Turborepo (`turbo.json`).
- Workspace globs:
  - `apps/*`
  - `workers/*`
  - `packages/*`

Primary directories:

- `apps/web`: SvelteKit frontend app with Supabase Auth.
- `workers/strava`: Worker code.
- `packages/shared`: Shared TypeScript package (includes generated database types).
- `supabase/migrations`: Database migrations.

## Branching and Diffs

- Workspace target base branch is `origin/main`.
- Use non-destructive diff commands like:
  - `git diff origin/main...`

## Web App (apps/web)

- SvelteKit + TypeScript (Svelte 5 runes mode).
- Cloudflare adapter enabled in `svelte.config.js`.
- Tailwind v4 loaded via Vite plugin and route-level stylesheet import.
- ESLint configured via `apps/web/eslint.config.js` with `eslint-plugin-svelte`.
- Supabase Auth via `@supabase/ssr` with server-side session handling.
- Shared app shell and auth-aware nav in `src/routes/+layout.svelte`.
- Shared styles in `src/routes/layout.css`.
- Routes/pages:
  - `src/routes/+page.svelte` — public home page.
  - `src/routes/auth/login/+page.svelte` — login/signup with form actions.
  - `src/routes/auth/logout/+server.ts` — POST endpoint for sign-out.
  - `src/routes/dashboard/+page.svelte` — protected, mock stats.
  - `src/routes/settings/+page.svelte` — protected, account info.
- Server-side files:
  - `src/hooks.server.ts` — creates Supabase client, attaches auth helpers to `event.locals`.
  - `src/routes/+layout.server.ts` — returns auth state to client layout.
  - `src/routes/auth/login/+page.server.ts` — login/signup form actions.
  - `src/routes/dashboard/+page.server.ts` — route protection via `requireUser`.
  - `src/routes/settings/+page.server.ts` — route protection, profile and Strava connection data.
- Auth helpers:
  - `src/lib/server/auth.ts` — `requireUser()` for protected routes.
  - `src/lib/server/profiles.ts` — `ensureProfile()` upserts a profiles row.
  - `src/lib/supabase.ts` — browser client factory (minimal, for future use).
- Dashboard data is mock/placeholder only.
- Navigation links use `resolve()` from `$app/paths` for base path safety.
- Environment variables: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` via `$env/dynamic/public`.

## Local Commands

From repo root:

- Install deps: `pnpm install`
- Web dev server: `pnpm --filter web dev`
- Web checks: `pnpm --filter web check`
- All workspace dev: `pnpm dev`
- All workspace build: `pnpm build`
- All workspace checks: `pnpm check`
- All workspace lint: `pnpm lint`
- Format check: `pnpm format`
- Format fix: `pnpm format:write`
- Generate DB types: `pnpm db:types`
- Start local Supabase: `npx supabase start`
- Reset local DB: `npx supabase db reset`

## Formatting

- Always run `pnpm prettier --write <file>` on every file you create or edit before committing.
- Alternatively, run `pnpm format:write` to fix the entire repo at once.
- CI runs `pnpm format` (a Prettier check) and will fail if any file is not formatted correctly.

## Implementation Constraints

- Keep `/dashboard` renderable with mock data until real Strava data is available.
- Preserve Cloudflare adapter setup for web deploy target.
- Keep UI responsive for desktop and mobile.
- No Strava OAuth or sync logic yet.
- No service role key in the SvelteKit app (only the public anon key).

## Animations

- Use Svelte's built-in transitions from `svelte/transition` (e.g. `slide`, `fade`, `fly`) rather than CSS `@keyframes` or JS animation libraries for enter/exit animations.
- For collapsible/accordion sections, use `transition:slide={{ duration: 200 }}` on a wrapper `div` with `overflow: hidden`.
- The `slide` transition does not work with `display: inline`, `display: table`, or `display: contents` — use `block`, `flex`, or `grid`.
- Keep transition durations short (150–250ms) for UI toggles.

## Agent Collaboration Notes

- Keep changes scoped; avoid unrelated refactors.
- Prefer editing existing route/layout files over introducing new framework layers.
- If adding shared UI primitives later, place them under `apps/web/src/lib`.
- Keep documentation updated when route structure or scripts change.
- Auth-related helpers live in `apps/web/src/lib/server/`.

## PR Instructions

Each PR should include a clear description and a manual testing checklist.

- Description section:
  - Include a `## Description` heading.
  - Summarize what changed and why.
  - Cover all meaningful changes in the branch diff, not just the latest commit.
- Manual testing section:
  - Include a `## Manual Testing` heading.
  - Provide concrete, reproducible steps to validate behavior.
  - Include expected results for each step so reviewers can confirm correctness.
  - Prefer route-level and command-level checks for app changes (for example `pnpm --filter web check`, `pnpm --filter web dev`, and validating key routes in the browser).
