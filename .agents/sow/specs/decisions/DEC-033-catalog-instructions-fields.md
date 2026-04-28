# DEC-033 — Catalog `instructions` + `instructions_url` fields, Netdata Cloud + Agent entries (2026-04-28)

**Problem.** Two of the auth-required servers we want to ship in the
curated catalog (Netdata Cloud, Netdata Agent) need credentials that
users can't guess. Today the add-server modal's "Pick a known server"
dropdown (DEC-017 #9) seeds name / url / transport / auth — but leaves
the user staring at an empty bearer-token input with no hint where to
get the token. The catalog entry needs a place to carry that
guidance, and the modal needs a place to render it.

The Netdata Agent case adds a second wrinkle: the URL is
per-deployment (`<host>:19999/mcp`), so a single shipped catalog URL
can't work — the entry has to instruct the user to edit the URL.

## Options considered

- **Inline-only** (replace short error with long instructions) —
  rejected: regresses every other auth-required entry where the short
  inline error is all the user needs.
- **Help block in `description`** — rejected: `description` is the
  ≤140-char dropdown summary; bloating it harms the dropdown.
- **Reuse `docs`** — rejected: `docs` answers "what does this server
  do" (linked from a generic info icon); auth-setup is a separate
  question. D4 = A keeps them separate.
- **Two new optional fields + persistent help block under the
  credential input** (chosen) — `instructions` (string ≤ 280 chars)
  for the in-modal sentence, `instructions_url` for the deeper read.
  Both optional (D2 = A). Help block stays visible while the user
  types the token (D3 = C — short inline error stays AND the help
  block persists), so they never lose sight of where to find the
  credential.

## Decision

1. Add two optional fields to `public/public-servers.schema.json`:
   - `instructions`: `{ type: string, minLength: 1, maxLength: 280 }`
   - `instructions_url`: `{ type: string, format: uri }`
2. Extend `CatalogServer` and the `loader.ts` sanitizer accordingly
   (defensive: `typeof === 'string'` check, schema is the contract).
3. Render a persistent `<Alert variant="light" color="blue">` in the
   add-server modal under the credential input whenever the picked
   known server carries either field. Visibility is keyed by
   `pickedKnownServerId` (set by `applyKnownServer`), and is cleared
   when the user edits the URL away from the catalog entry's URL.
4. Ship two Netdata entries: **Netdata Cloud** (`active`,
   CORS-permissive from `https://ktsaou.github.io` confirmed
   2026-04-28); **Netdata Agent** (`unstable`, placeholder URL +
   instructions tell the user to edit, browser CORS / mixed-content
   unverified).

## Falsifier

The decision is bad if any of these hold:

1. Existing `public-servers.json` entries fail to validate after the
   schema change (any field mismatch breaks the boot auto-merge).
2. The help block appears when no known server is picked, or stays
   stuck after the user diverges from the catalog URL.
3. The help block disappears the moment the user types a token —
   D3 = C requires both the short inline error AND the persistent
   help block.
4. Picking a known server with NEITHER `instructions` nor
   `instructions_url` (e.g. the existing Cloudflare API entry)
   renders an empty Alert, an empty link, or any visual artifact.
5. The `instructions` text is rendered as raw HTML (XSS — must be
   plain `<Text>` content).
6. Bundle exceeds 350 KB gz (DEC-005).
7. The 390×844 mobile layout pushes the Save button below the fold
   when the help block is rendered.

## Status

In flight — implemented under SOW-0006. UX-critic gate runs after
the maintainer cuts the live deploy (per DEC-002, mandatory for
visible-surface changes; Costa-direct verification supersedes per
`.agents/skills/project-testing/SKILL.md`).
