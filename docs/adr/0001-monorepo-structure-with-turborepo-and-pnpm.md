# ADR-0001: Monorepo Structure with Turborepo and pnpm Workspaces

## Status

Accepted

## Context

Ban4Life comprises multiple applications and shared libraries:
1. A backend service (`apps/api`) built on NestJS and Baileys.
2. A single-page dashboard (`apps/web`) built on React, Vite, and Tailwind CSS.
3. Domain contracts, DTOs, and event interfaces (`packages/types`) required by both frontend and backend.
4. Shared TypeScript configurations (`packages/tsconfig`).

Historically, teams maintain either polyrepos (independent git repositories per service) or monorepos. In polyrepos, sharing DTOs and domain types requires publishing internal npm packages or manually duplicating interfaces, which invariably leads to type drift and runtime serialization mismatches between frontend and backend.

## Decision

We adopt a **monorepo architecture** managed via **pnpm workspaces** and orchestrated by **Turborepo**.

```text
ban4life/
├── apps/
│   ├── api/            # NestJS API, Baileys socket, SQLite database
│   └── web/            # React + Vite dashboard
├── packages/
│   ├── types/          # Domain types, SSE payloads, DTO contracts
│   └── tsconfig/       # Base tsconfig configurations
├── pnpm-workspace.yaml
└── turbo.json
```

Key structural decisions:
1. `packages/types` is linked via `workspace:*`, ensuring instantaneous compile-time synchronization without build or publish steps during development.
2. `pnpm` was selected for its content-addressable storage mechanism, drastically minimizing disk footprint and guaranteeing strictly deterministic dependency trees.
3. `Turborepo` coordinates caching across tasks (`build`, `test`, `lint`), ensuring that unchanged packages are not recompiled unnecessarily in local development and continuous integration.

## Consequences

### Positive

* **Zero Type Drift:** Any modification to `GroupDto`, `SpamLogDto`, or `SettingsDto` immediately surfaces TypeScript compiler errors in both API and Web before code reaches production.
* **Atomic Pull Requests:** Features touching both backend logic and frontend UI can be reviewed and tested within a single atomic commit and pull request.
* **Fast CI Execution:** Turborepo caches successful build and test tasks across pipeline runs.

### Negative / Trade-offs

* **Tooling Complexity:** Requires understanding of workspace-aware package managers and Turborepo configuration pipelines.
* **Monolithic CI Runs:** Without incremental task filtering, commits touching root configurations trigger full workspace test runs.
