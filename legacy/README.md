# legacy/ — pre-v1.0 prototype

These three files are the working prototype that this project was forked
from. They continue to live here as a reference during the v1.0 rewrite so
we can:

- Compare new behaviour against a known-working implementation.
- Port schema-rendering edge cases one by one into the new TypeScript
  implementation (`src/schema-form/`).
- Let users with older bookmarks continue to use the old UI via
  `https://ktsaou.github.io/mcp-test-client/legacy/` if we decide to keep
  it deployed as a fallback.

**Do not modify** these files. They are frozen. All new work happens in
`src/`. When v1.0 ships and we have full parity, this directory will be
removed in the same commit that bumps the `CHANGELOG.md`.

- `index.html` — 3661 lines, vanilla JS + embedded CSS, single-file app
- `mcp-schema-ui-generator.js` — 2466 lines, class-based JSON-Schema → HTML
  form renderer. Solid coverage; this is what we're porting.
- `json-pretty-printer.js` — 312 lines, JSON pretty-printer with
  nested-JSON detection. Also porting.

Heritage: originally developed inside the
[Netdata](https://github.com/netdata/netdata) repository as a test client
for Netdata's MCP server. The branding bleed-through (Netdata in the
title, in `clientInfo.name`, and in the light-blue colour palette) is the
clearest reason for the rewrite.
