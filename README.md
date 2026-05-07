# Workout Dashboard Monorepo

This repository is a TypeScript `pnpm` workspace powered by Turborepo.

## Architecture

- `apps/web`: Future frontend dashboard application.
- `workers/strava`: Future background worker for Strava ingest/sync jobs.
- `packages/shared`: Shared TypeScript types, utilities, and domain contracts.
- `supabase/migrations`: SQL migrations for Supabase schema changes.

## Tooling Foundation

- `pnpm` workspaces for package management.
- Turborepo task orchestration and caching.
- Shared TypeScript base config in `tsconfig.base.json`.
- Shared ESLint flat config in `eslint.config.mjs`.
- Shared Prettier config in `.prettierrc.json`.

## Scripts

Run from repo root:

- `pnpm dev`: Run all workspace `dev` scripts in parallel.
- `pnpm build`: Build all workspaces.
- `pnpm check`: Run TypeScript checks (`tsc --noEmit`) across workspaces.
- `pnpm lint`: Run ESLint across workspaces.
- `pnpm test`: Run placeholder test scripts across workspaces.
- `pnpm format`: Check formatting with Prettier.
- `pnpm format:write`: Apply formatting with Prettier.

## Getting Started

```bash
pnpm install
pnpm lint
pnpm check
```

This baseline intentionally contains no app features yet; it only establishes the monorepo foundation.
