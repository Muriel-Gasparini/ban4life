# Contributing to Ban4Life

Thank you for your interest in contributing to Ban4Life. This project follows strict engineering standards to maintain high performance, reliability, and security across the codebase.

## Code of Conduct

All contributors must adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

## Monorepo Architecture

Ban4Life is organized as a pnpm workspace orchestrated by Turborepo:

```text
ban4life/
├── apps/
│   ├── api/            # NestJS 11 backend, Baileys socket, TypeSafe Jev service, SQLite/Drizzle
│   └── web/            # React 18 + Vite dashboard, Tailwind CSS, Server-Sent Events client
├── packages/
│   ├── types/          # Shared TypeScript domain contracts and DTOs
│   └── tsconfig/       # Base TypeScript configurations
├── docs/
│   └── adr/            # Architecture Decision Records
└── docker-compose.yml  # Production deployment configuration
```

## Prerequisites

Ensure you have the following installed on your local machine:

* **Node.js:** `>= 20.12.0` (LTS recommended)
* **pnpm:** `>= 11.0.0`
* **Docker & Docker Compose:** For running local integration environments
* **Git:** `>= 2.40.0`

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Muriel-Gasparini/ban4life.git
   cd ban4life
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your desired credentials (`ADMIN_PASSWORD`, `JWT_SECRET`, and optional `TYPESAFE_API_KEY`).

4. **Build the packages and applications:**
   ```bash
   pnpm build
   ```

5. **Start local development servers:**
   ```bash
   pnpm dev
   ```
   * Unified Dashboard & API: `http://localhost:3000` (the API serves the built dashboard and backend endpoints using `.env`)
   * Vite UI Dev Server (optional for frontend HMR): `http://localhost:5173` (proxies `/api` to port 3000)

6. **Run test suites:**
   ```bash
   pnpm test
   ```

## Commit Message Convention

Ban4Life strictly enforces the **Conventional Commits v1.0.0** specification. Automated continuous integration checks will reject pull requests whose titles or commits violate these rules.

### Structure

```text
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Permitted Types

* `feat`: A new feature introduced to the user or API.
* `fix`: A bug fix.
* `docs`: Documentation changes only (e.g., README, ADRs, JSDoc).
* `refactor`: A code change that neither fixes a bug nor adds a feature.
* `test`: Adding missing tests or correcting existing tests.
* `ci`: Changes to CI configuration files and scripts (e.g., GitHub Actions).
* `chore`: Maintenance tasks, dependency updates, or internal build configurations.
* `perf`: A code change that improves performance.

### Permitted Scopes

* `api`: Changes within `apps/api`
* `web`: Changes within `apps/web`
* `types`: Changes within `packages/types`
* `deps`: Dependency updates
* `adr`: Architectural decision records

### Examples

* Good: `feat(api): implement cross-group ban propagation via SHA-256 hash table`
* Good: `fix(web): resolve footer text truncation in real-time spam feed cards`
* Good: `docs(adr): add ADR-0002 evaluating TypeSafe Jev System-1 model`
* Bad: `Update stuff`
* Bad: `Fixing bug with emojis 🚀🔥`

## Pull Request Guidelines

1. **Branch Naming Convention:**
   Create a dedicated branch from `main`:
   * `feat/<short-description>`
   * `fix/<short-description>`
   * `docs/<short-description>`
   * `refactor/<short-description>`

2. **Self-Review Checklist Before Submitting:**
   * Run `pnpm test` to ensure all 57+ unit and integration tests pass.
   * Run `pnpm lint` and ensure no ESLint warnings or errors remain.
   * Run `pnpm build` to verify production compilation across all packages.
   * Do not commit compiled artifacts or `.env` files.
   * Avoid informal commentary, humor, or emojis in commit messages and documentation.

3. **Opening the Pull Request:**
   * Open a PR targeting the `main` branch.
   * Fill out all sections of the Pull Request template.
   * Ensure the PR title adheres to the Conventional Commits specification.
   * Link any related issues using GitHub keywords (e.g., `Closes #42`).

4. **Review Process:**
   * Automated CI workflows will execute linting, typechecks, unit tests, and build validation.
   * Direct pushes to `main` are strictly blocked. Merging requires passing all CI status checks and an approving review from a maintainer.
   * Squash and merge or rebase and merge are enforced to maintain a clean linear Git history.
