# Security Policy

## Supported Versions

The following table indicates the support lifecycle for Ban4Life releases:

| Version | Supported          | Security Updates |
| ------- | ------------------ | ---------------- |
| 1.0.x   | Yes                | Active           |
| < 1.0   | No                 | Discontinued     |

## Reporting a Vulnerability

The Ban4Life maintainers take security seriously. If you discover a vulnerability, follow responsible disclosure practices to protect users of this software.

### Method 1: GitHub Private Vulnerability Reporting (Preferred)

If you have a GitHub account, submit a report directly through the repository:

1. Navigate to the repository on GitHub.
2. Select the **Security** tab.
3. Under "Reporting a vulnerability", select **Report a vulnerability**.
4. Fill in the advisory details, reproduction steps, and potential impact.

### Method 2: Security Contact Email

If you cannot use GitHub Private Vulnerability Reporting, send an encrypted or plaintext email to:

* **Email:** `security@ban4life.org`
* **Subject:** `[SECURITY] Potential vulnerability in Ban4Life`

Please include the following details in your report:

* Component affected (`apps/api`, `apps/web`, `packages/*`, or deployment configuration).
* Description of the vulnerability and its potential impact.
* Minimal, reproducible proof-of-concept steps or code.
* Any potential mitigations or patches you have identified.

## Response Process and SLA

1. **Initial Response:** Within 48 hours, a maintainer will acknowledge receipt of your vulnerability report.
2. **Triage and Verification:** Within 5 business days, the team will verify the vulnerability, evaluate severity using CVSS metrics, and determine an remediation timeline.
3. **Fix and Testing:** A fix will be developed in a private security fork and verified with automated test suites.
4. **Advisory and Disclosure:** Once a fix is ready, a coordinated release date will be scheduled. A CVE identifier will be requested through GitHub, and credit will be granted to the reporter (unless anonymity is requested).

Please do not open public GitHub issues, pull requests, or discuss vulnerabilities in public channels until an official release addressing the issue has been published.
