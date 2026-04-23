# Security Policy

## Reporting a vulnerability

Please **do not open a public GitHub issue** for security problems.

Open a [private security advisory](https://github.com/ktsaou/mcp-test-client/security/advisories/new)
on GitHub. This goes directly to the maintainers.

Include:

- A description of the issue and its impact.
- Minimal steps to reproduce.
- Your assessment of severity if you have one.
- Optional: a suggested fix.

We will acknowledge receipt within 7 days. If the issue is confirmed, we
will agree on a disclosure timeline before publishing a fix.

## Scope

### In scope

- The hosted application at the published GitHub Pages URL.
- Any file in this repository.
- The static build artefacts produced by `npm run build`.

### Out of scope

- MCP servers that users connect to. Those are third-party and have their
  own security posture.
- The host browser and OS.
- Social engineering.

## Threat model

See [`specs/security.md`](specs/security.md) for our threat model — what
we defend against, what we rely on, and what trade-offs we've accepted.

## Notable design choices

- **No backend, no telemetry, no account.** The only server traffic the app
  generates is to MCP servers the user explicitly configures.
- **No third-party runtime deps in production.** Everything needed to run is
  served from our origin.
- **CSP enforced** via `<meta http-equiv>`. See `specs/security.md` §4.
- **localStorage tokens**: bearer tokens users paste in are stored in
  localStorage. This is readable by any script on our origin; we accept
  that risk because we load no third-party scripts, and we document the
  trade-off in the UI.

## Dependencies

`npm audit --audit-level=high` runs on every PR and blocks merges on
failure. Dependabot raises PRs weekly. Unpatched high-severity advisories
on a direct dependency are treated as P1 bugs.
