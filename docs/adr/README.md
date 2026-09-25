# Architecture Decision Records (ADRs)

This directory documents the architectural and engineering decisions made during the design and development of Ban4Life. Each record follows the Michael Nygard / MADR (Markdown Architectural Decision Records) specification, capturing the context, alternatives considered, technical trade-offs, and consequences of each decision.

## Index of Decisions

| ADR | Title | Status | Date |
| --- | ----- | ------ | ---- |
| [ADR-0001](0001-monorepo-structure-with-turborepo-and-pnpm.md) | Monorepo Structure with Turborepo and pnpm Workspaces | Accepted | 2026-09-24 |
| [ADR-0002](0002-typesafe-jev-system-1-judgment-primitive.md) | TypeSafe Jev System-1 Judgment Primitive for Spam Moderation | Accepted | 2026-09-24 |
| [ADR-0003](0003-baileys-whatsapp-multi-device-integration.md) | WhatsApp Multi-Device Protocol via Baileys Socket | Accepted | 2026-09-24 |
| [ADR-0004](0004-two-tier-defense-lru-cache-and-cross-group-ban.md) | In-Memory Two-Tier Defense: 0ms SHA-256 LRU Cache and Cross-Group Ban | Accepted | 2026-09-24 |
| [ADR-0005](0005-embedded-storage-with-sqlite-and-drizzle-orm.md) | Embedded Relational Storage with SQLite and Drizzle ORM | Accepted | 2026-09-24 |
| [ADR-0006](0006-server-sent-events-for-realtime-telemetry.md) | Server-Sent Events (SSE) for Unidirectional Dashboard Telemetry | Accepted | 2026-09-24 |

## Decision Statuses

* **Proposed:** The decision is under evaluation by core maintainers.
* **Accepted:** The decision has been agreed upon and implemented in the codebase.
* **Superseded:** The decision was replaced by a newer ADR referenced in the document.
* **Rejected:** The proposed decision was rejected after evaluation.
