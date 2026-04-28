# SOW-0006 | 2026-04-28 | catalog-instructions-netdata-entries

## Status

in-progress
SOW-0007 shipped 2026-04-28 (v1.3.1). Resuming SOW-0006. CORS preflight on Netdata Cloud confirmed CORS-permissive from `https://ktsaou.github.io` (preflight 200, allow-origin echoed, Authorization in allow-headers) — Cloud entry shifts from `unstable` to `active`. Agent stays `unstable` (per-user URL + likely mixed-content).

## Requirements

### Purpose

Two Netdata MCP servers (Agent + Cloud) need credentials to use, and users won't know where to find their key without help. Add an `instructions` field (text) and `instructions_url` field (URI) to the catalog so the add-server modal can guide the user to their token; ship the two Netdata entries as the first consumers.

### User request (verbatim)

> I want to add Netdata Agent and Netdata Cloud to the list of protected MCP clients. The specs should include the field called instructions with instructions on how to find the required key and an instructions_url which you can read to find the required key. Both of them should affect the missing required field (value).

### Assistant understanding

- "list of protected MCP clients" = the **auth-required known-servers dropdown** in the add-server modal (`src/ui/server-picker.tsx:354`); populated from `public/public-servers.json` filtered by `auth !== 'none'`.
- Two **new fields** on the catalog schema: `instructions` (string, plain text), `instructions_url` (URI).
- The fields surface in the add-server modal when an auth-required known server is picked, helping the user obtain the credential.
- "missing required field (value)" = the inline error under the empty credential field (`server-picker.tsx:594/606/613`).

### Acceptance criteria

1. **Schema accepts new fields.** `public-servers.schema.json` declares `instructions` (string, ≤ 280 chars) and `instructions_url` (string, format uri), both optional. Verify: schema validator passes; existing entries still validate.
2. **Loader sanitizer parses safely.** `src/catalog/loader.ts` accepts entries with new fields and silently drops malformed values. Verify: unit test with valid/missing/invalid `instructions` + `instructions_url`.
3. **Persistent help block under credential field** (D3 = C). When the user picks a known server whose entry has `instructions` and/or `instructions_url`, a **persistent help block** renders under the credential field showing the `instructions` text and a "Where to find this →" link to `instructions_url`. Visible regardless of credential field's empty state. Verify: component test asserts the help text + link appear after dropdown selection and persist while the user types.
4. **Empty-state inline error remains short** (D3 = C). The "Token required" / "Header value required" string stays as today; the persistent help block above carries the longer instructions.
5. **Netdata Cloud entry.** New entry in `public-servers.json`:
   - `id: "netdata-cloud"`, `auth: "bearer"`, `transport: "streamable-http"`, URL `https://app.netdata.cloud/api/v1/mcp`
   - `instructions`: explains "Generate an API token with `scope:mcp` in app.netdata.cloud → Profile → User Settings → API Tokens. Business plan required."
   - `instructions_url`: `https://docs.netdata.cloud/docs/netdata-cloud/authentication-and-authorization/api-tokens`
   - `docs`: `https://docs.netdata.cloud/docs/netdata-ai/mcp/README`
   - `status`: `active` (CORS preflight verified 2026-04-28 — `https://ktsaou.github.io` echoed in `access-control-allow-origin`, `Authorization` in `access-control-allow-headers`, POST allowed).
6. **Netdata Agent entry** (D1 = B — placeholder URL). New entry:
   - `id: "netdata-agent"`, `auth: "bearer"`, `transport: "streamable-http"`, URL `http://your-netdata-host:19999/mcp`
   - `instructions`: tells the user to **edit the URL to their Netdata Agent host**, then run `sudo cat /var/lib/netdata/mcp_dev_preview_api_key` for the key. Mentions that the agent must be claimed.
   - `instructions_url`: `https://docs.netdata.cloud/docs/netdata-ai/mcp/README`
   - `status`: `unstable` (browser CORS + mixed-content unverified — see Followup)
7. **No regression on existing UI.** Existing dropdown behaviour preserved: picking an entry fills name / url / transport / auth; the rest of the form remains editable.
8. **Bundle.** Stays under DEC-005's 350 KB gz cap.

## Analysis

Sources consulted:

- DEC-017 (`.agents/sow/specs/decisions/DEC-017-curated-server-catalogs.md`).
- `specs/public-servers-catalog.md` (governance + field reference).
- `public/public-servers.schema.json` (schema), `public/public-servers.json` (current entries).
- `src/catalog/{loader,types}.ts` (catalog loading + sanitizer).
- `src/ui/server-picker.tsx:340-655` (add-server modal: auth dropdown, credential fields, inline errors).
- Subagent research on Netdata Agent + Netdata Cloud MCP endpoints (cites in Execution log on advance).

Key findings:

- **Netdata Agent** (high confidence; cites in `~/src/netdata-ktsaou.git/`): exposes `<host>:19999/mcp` over streamable-http (v2.7.2+); `Authorization: Bearer <key>` (`src/web/api/http_header.c:213`); key at `/var/lib/netdata/mcp_dev_preview_api_key` (`src/web/api/mcp_auth.c:59-61,128`); requires claim. **URL is per-deployment** — no fixed value works.
- **Netdata Cloud** (high confidence): single endpoint `https://app.netdata.cloud/api/v1/mcp` (streamable-http); bearer with `scope:mcp` token from app.netdata.cloud → Profile → User Settings → API Tokens; **Business plan required**.

Marked:

- Facts: file:line cites above.
- Inference: CORS posture from `https://ktsaou.github.io` origin unknown — needs live test.
- Working theory: a CORS-permissive claimed-parent MCP URL might offer Netdata Agent a fixed-URL path; not yet verified.

## Implications and decisions

User decisions, locked 2026-04-28:

- **D1 = B** — Netdata Agent ships with placeholder URL `http://your-netdata-host:19999/mcp`; instructions tell the user to edit URL before connecting. **Implication:** dropdown-select doesn't yield a one-click connect for the Agent entry. **Mitigation:** instructions explicit; status `unstable`.
- **D2 = A** — Both `instructions` and `instructions_url` are optional. Either can stand alone. **Implication:** catalog authors choose what to provide.
- **D3 = C** — Both: short empty-field error stays AND a persistent help block under the credential field shows instructions + link. **Implication:** the help block adds vertical space to the modal; layout to verify on 390-px mobile.
- **D4 = A** — `instructions_url` is a separate field from `docs`. `docs` = "what does this server do"; `instructions_url` = "how do I authenticate". **Implication:** entries can carry both URLs cleanly.
- **D5 = A** — Open this SOW; non-trivial work.

Risk register:

- Browser CORS posture not verified for either Netdata endpoint → both ship `status: unstable`.
- Mixed-content (`https→http`) unfixable for Netdata Agent from the live deploy → instructions must call this out; users self-host can serve the app from `http://` to test.
- DEC-002 mandates UX-critic gate for visible-surface changes (the modal help block).

## Plan

Single-unit (low risk; tightly coupled scope).

Files anticipated:

1. `public/public-servers.schema.json` — add `instructions`, `instructions_url` to `$defs.server.properties`.
2. `src/catalog/types.ts` — add fields to `CatalogServer`.
3. `src/catalog/loader.ts` — extend sanitizer; ignore invalid types.
4. `public/public-servers.json` — add Netdata Cloud + Netdata Agent entries.
5. `src/ui/server-picker.tsx` — render the persistent help block under the credential field when the active known-server has `instructions` or `instructions_url`.
6. `specs/public-servers-catalog.md` — document the two new fields in the schema reference.
7. `src/catalog/loader.test.ts` — sanitizer cases (valid / missing / invalid type).
8. `src/ui/server-picker.test.tsx` — assert help block appears after picking a known server with these fields; persists across credential-field state changes.
9. New `DEC-032` under `.agents/sow/specs/decisions/` — record the schema additions + Netdata entries.

Worker brief: single Worker; falsifier = the acceptance criteria above.

Validation gates (deferred until execution):

- Pipeline green: `npm run typecheck && npm run lint && npm test && npm run build && npm run check:bundle`.
- Unit/component tests for sanitizer + help block.
- UX-critic pass on the live deploy (DEC-002): brief targets the Netdata Cloud entry — verify the help block renders correctly on Chromium 1280 + 390-px mobile, the inline empty-field error still surfaces, and the layout doesn't push the Save button below the fold on mobile.
- Bundle: under 350 KB gz.
- CORS verification deferred to Followup.

## Execution log

(To be filled when work begins.)

## Validation

(To be filled at completion.)

## Outcome

(To be filled at completion.)

## Lessons extracted

(To be filled at completion.)

## Followup

- **CORS / mixed-content verification** for both Netdata MCP endpoints from `https://ktsaou.github.io` origin. If both pass → downgrade `status` to `active` in a follow-up SOW.
- **Claimed-parent MCP URL for Netdata Agent**: if Costa confirms a CORS-permissive Cloud-backed Agent URL exists, replace the placeholder approach with that.
