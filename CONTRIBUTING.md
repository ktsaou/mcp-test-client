# Contributing

Thank you for considering a contribution. This project exists to help the
community exercise public MCP servers — every useful PR makes that easier.

## Quick facts

- **License**: GPL-3.0-or-later. Every contribution is licensed the same.
- **Issue tracker**: GitHub issues.
- **Maintainer**: Claude, running autonomously under the repo owner's
  authority. See [`CLAUDE.md`](CLAUDE.md) for how that works.

## What's welcome

- Bug reports with a reproduction (ideally a link to a public MCP server
  exhibiting the issue, or a minimal schema that fails to render).
- PRs for:
  - Additional real-world schemas in
    `tests/conformance/real-schemas/` that currently render poorly.
  - Entries in `public/public-servers.json` for public MCP servers.
  - Fixes for rendering bugs in `src/schema-form/`.
  - Accessibility improvements.
  - Translations of the UI (stretch goal, v1.1).
- Documentation improvements.

## What's out of scope

- stdio transport (browsers cannot spawn processes).
- Backend services, user accounts, telemetry, analytics — ever.
- Desktop wrappers.
- Features that are useful only for authors debugging their own server; those
  belong in [MCP Inspector](https://github.com/modelcontextprotocol/inspector).

## Development

```bash
npm ci
npm run dev          # vite dev server
npm run lint         # eslint + prettier
npm run typecheck    # tsc --noEmit
npm run test         # vitest
npm run test:e2e     # playwright
npm run build        # produce ./dist
```

All of the above must pass locally before opening a PR. CI runs the same
checks.

## PR checklist

- [ ] `npm run lint`, `npm run typecheck`, `npm run test` are green.
- [ ] If behaviour changed, the relevant file in [`specs/`](specs/) is
      updated in the same PR.
- [ ] New fields in `public/public-servers.json` respect the JSON Schema in
      `public/public-servers.schema.json`.
- [ ] No new runtime dependencies unless discussed in the issue first.
- [ ] Commit messages explain _why_, not just _what_.

## Code style

- TypeScript strict mode. No `any` except at explicit interop boundaries
  (document why).
- React functional components only.
- No inline styles; use CSS custom properties under `src/ui/theme.css`.
- Public functions get JSDoc if the signature alone does not explain them.
  Private helpers rarely need comments.
- Test every schema-form field type; the conformance suite is the
  safety net.

## Reviewing PRs

Claude reviews and merges. Human maintainers may step in at any time —
their decisions override Claude's. If you disagree with a review, say so in
the PR and a human will arbitrate.

## Reporting security issues

See [`SECURITY.md`](SECURITY.md). Do not open public issues for vulnerabilities.

## Code of conduct

See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — the Contributor Covenant.
