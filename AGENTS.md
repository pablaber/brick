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

- `apps/web`: SvelteKit frontend app.
- `workers/strava`: Worker code.
- `packages/shared`: Shared TypeScript package.
- `supabase/migrations`: Database migrations.

## Branching and Diffs

- Workspace target base branch is `origin/main`.
- Use non-destructive diff commands like:
  - `git diff origin/main...`

## Web App (apps/web)

Implemented in this phase:

- SvelteKit + TypeScript scaffold.
- Cloudflare adapter enabled in `svelte.config.js`.
- Tailwind loaded via Vite plugin and route-level stylesheet import.
- Shared app shell and nav in `src/routes/+layout.svelte`.
- Shared styles in `src/routes/layout.css`.
- Initial routes/pages:
  - `src/routes/+page.svelte`
  - `src/routes/dashboard/+page.svelte`
  - `src/routes/settings/+page.svelte`
  - `src/routes/auth/login/+page.svelte`
- Dashboard data is mock/placeholder only.

## Local Commands

From repo root:

- Install deps: `pnpm install`
- Web dev server: `pnpm --filter web dev`
- Web checks: `pnpm --filter web check`
- All workspace dev: `pnpm dev`
- All workspace checks: `pnpm check`

## Implementation Constraints

- Do not add Supabase or Strava integration logic in the current dashboard phase.
- Keep `/dashboard` renderable with mock data.
- Preserve Cloudflare adapter setup for web deploy target.
- Keep UI responsive for desktop and mobile.

## Agent Collaboration Notes

- Keep changes scoped; avoid unrelated refactors.
- Prefer editing existing route/layout files over introducing new framework layers.
- If adding shared UI primitives later, place them under `apps/web/src/lib`.
- Keep documentation updated when route structure or scripts change.
