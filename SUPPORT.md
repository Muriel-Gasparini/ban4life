# Support Guidelines

Thank you for using Ban4Life. This document outlines the official channels for seeking assistance, asking questions, and reporting defects.

## Community Support Channels

### 1. GitHub Discussions

For general inquiries, deployment questions, architecture discussions, and feedback:

* **Location:** Repository **Discussions** tab.
* **Categories:**
  * **Q&A:** Questions about configuration, environment variables, and Docker deployment.
  * **Ideas:** Propose new features or improvements before submitting an issue.
  * **Show and Tell:** Share your deployment setup or integrations.

### 2. GitHub Issues

GitHub Issues are reserved strictly for actionable bugs and verified defects in the codebase.

* **Bug Reports:** Use the official Bug Report issue template. Ensure you include runtime logs, reproduction steps, and node/docker versions.
* **Feature Requests:** Submit via the Feature Request issue template only after initial consensus in GitHub Discussions.

Do not use GitHub Issues for:
* General WhatsApp API troubleshooting unrelated to Ban4Life.
* TypeSafe API account administration or billing issues (refer to the official TypeSafe support portal).
* Questions that can be resolved by reading the project documentation or ADRs.

## Scope of Support

The project maintainers provide support on a best-effort basis for:
* The latest released tag and the `main` branch.
* Standard Docker Compose deployments following the official documentation.
* Core engine modules (`@ban4life/api`, `@ban4life/web`, `@ban4life/types`).

Support is not provided for:
* Outdated versions (< 1.0).
* Unofficial forks or customized Baileys socket integrations.
* Non-standard database backends replacing SQLite without an approved ADR.
