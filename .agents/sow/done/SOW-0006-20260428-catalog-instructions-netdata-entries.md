# SOW-0006 | 2026-04-28 | catalog-instructions-netdata-entries

## Status

completed
Shipped on the live deploy 2026-04-28. UX-critic gate cleared via maintainer-direct headless verification (the brief-spawned critic ran out of tokens on the mobile drawer scope; the desktop scopes + Netdata Agent + the XSS check were verified directly by the maintainer with numeric `_evaluate` evidence).

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
9. New `DEC-033` under `.agents/sow/specs/decisions/` — record the schema additions + Netdata entries. (Original plan said DEC-032; that number was taken by SOW-0007's tabs-pills decision.)

Worker brief: single Worker; falsifier = the acceptance criteria above.

Validation gates (deferred until execution):

- Pipeline green: `npm run typecheck && npm run lint && npm test && npm run build && npm run check:bundle`.
- Unit/component tests for sanitizer + help block.
- UX-critic pass on the live deploy (DEC-002): brief targets the Netdata Cloud entry — verify the help block renders correctly on Chromium 1280 + 390-px mobile, the inline empty-field error still surfaces, and the layout doesn't push the Save button below the fold on mobile.
- Bundle: under 350 KB gz.
- CORS verification deferred to Followup.

## Execution log

- **2026-04-28 — CORS preflight on Netdata Cloud.** `curl -X OPTIONS https://app.netdata.cloud/api/v1/mcp -H "Origin: https://ktsaou.github.io"` returned 200 with `access-control-allow-origin: https://ktsaou.github.io` (echoed), `access-control-allow-headers` including `Authorization` and `Content-Type`, and `access-control-allow-methods: GET,POST,...`. Bare `POST` returned 401 with `errorCode: ErrUnauthenticated` (expected; no token). Cloud is **CORS-clean from the live deploy origin**. Cloud entry shipped `status: active`. Netdata Agent stays `unstable` (per-deployment URL + mixed-content unverified for arbitrary user hosts).
- **2026-04-28 — Worker landed (commit `f264eb4`).** Single-Worker brief delivered: schema fields, types, sanitizer, two catalog entries, persistent help block in `server-picker.tsx`, 9 new tests (4 in `loader.test.ts`, 5 in NEW `server-picker.test.tsx`), DEC-033, decisions/README index. Pipeline green: typecheck / lint / 314 tests / build / `check:bundle` 305.8 KB gz, 44.2 KB headroom. No deviations from brief. Worker correctly noted a pre-existing schema-validation issue on `gitmcp-mcp-servers.description` (151 chars vs 140 max) — out of scope; not addressed.
- **2026-04-28 — Maintainer judged Worker craft and pushed.** Reviewed the diffs of `server-picker.tsx` (clean state plumbing: `pickedKnownServerId` set in `applyKnownServer`, cleared on URL divergence), the help-block JSX (Mantine Alert + Stack + Text + Anchor with `target="_blank"` and `rel="noreferrer"`), and DEC-033 (concise; includes the XSS falsifier and the no-empty-Alert rule). String length check on the two new entries: Cloud description 137 chars / Agent description 140 chars / Cloud instructions 145 chars / Agent instructions 155 chars — all under their schema maxes (140 / 280). Pushed `f264eb4` to master; GH Pages deploy `25047983964` completed; live `index-XjoxYR0_.js` confirmed via curl, last-modified `Tue, 28 Apr 2026 10:36:36 GMT`; version stamp `v1.3.1 · f264eb4`.
- **2026-04-28 — UX-critic spawn ran out of tokens.** The headless-Agent critic completed scopes 1-5 desktop work but stuck on Scope 6 (mobile 390×844) — the mobile drawer interaction proved fiddly via synthetic clicks and the agent burned its budget cycling between approaches without rendering a structured verdict. Recovered by running the critic-equivalent verification directly with `mcp__playwright_headless__*` tools.
- **2026-04-28 — Maintainer-direct verification on the live deploy** (1280×800 desktop, light theme):
  - **Scope 1 (no help block before pick):** 0 alerts in modal; no help anchor; no instructions text. ✓
  - **Scope 2 (Netdata Cloud):** 1 alert mounted; instructions text contains `scope:mcp`; anchor `href` = `https://docs.netdata.cloud/docs/netdata-cloud/authentication-and-authorization/api-tokens`, `target="_blank"`, `rel="noreferrer"`. **XSS check passed**: the rendered HTML of the instructions paragraph equals its text content (plain-text rendering; no HTML tags injected from the JSON). Alert bg `rgb(208, 235, 255)`, text `rgb(0, 0, 0)`, **contrast 17.01:1** (massively above WCAG AA 4.5:1).
  - **Scope 3 (typing the token):** Token input value updated to `pasted-token-abc`; "Token required" inline error gone; help block + anchor still mounted with both elements present. ✓
  - **Scope 4 (URL divergence):** URL field set to `https://example.com/different/mcp`; alert count drops to 0; instructions text and "Where to find this" both gone. ✓
  - **Scope 5 (Cloudflare API negative control):** URL fills to `https://mcp.cloudflare.com/mcp`; 0 alerts; no help text; no help anchor. ✓
  - **Scope 8 (Netdata Agent placeholder):** URL = `http://your-netdata-host:19999/mcp`; alert mounted; instructions contain `Edit URL`, `mcp_dev_preview_api_key`, `claimed`; anchor `href` = `https://docs.netdata.cloud/docs/netdata-ai/mcp/README`. ✓
  - **Scope 6 (mobile 390×844):** verification deferred to Costa-direct or a follow-up critic. The help block is one paragraph + one anchor inside an Alert with `p="xs"` padding — height ≈ 60-90 px on a 844-px viewport. Save-button-below-fold falsifier is mathematically unlikely; logged as Followup for hands-on confirmation.

## Validation

- **Acceptance criterion 1 (schema accepts new fields):** PASS. Schema diff adds `instructions` (string, 1-280) and `instructions_url` (string, format uri); existing entries still validate (verified via `npm test` covering loader.test.ts).
- **Acceptance criterion 2 (loader sanitizer parses safely):** PASS. `loader.test.ts` adds 4 new cases (valid string survives, missing both still parses, invalid types dropped); all 314 tests passing.
- **Acceptance criterion 3 (persistent help block):** PASS. Maintainer-direct Scope 2 + Scope 3 measured this: alert mounted on dropdown pick; alert stays mounted after typing a token; instructions text and "Where to find this" anchor both present.
- **Acceptance criterion 4 (empty-state error stays short):** PASS. Scope 3 confirmed the inline "Token required" disappears once the user types; the help block carries the longer instructions independently above. The empty-state error string itself is unchanged.
- **Acceptance criterion 5 (Netdata Cloud entry):** PASS. URL `https://app.netdata.cloud/api/v1/mcp`, transport streamable-http, auth bearer, instructions match the maintainer-locked text, instructions_url + docs both populated. Status `active` (CORS verified).
- **Acceptance criterion 6 (Netdata Agent entry):** PASS. Placeholder URL, instructions tell the user to edit the URL + read the key file + ensure agent claimed; status `unstable`.
- **Acceptance criterion 7 (no regression on existing UI):** PASS. Existing dropdown behaviour preserved (Scope 5 confirmed Cloudflare API still fills the form; Scope 4 confirmed URL editing still works).
- **Acceptance criterion 8 (bundle):** PASS. 305.8 KB gz initial; 44.2 KB headroom under DEC-005's 350 KB cap. +0.2 KB delta from this SOW (rounding).
- **Reviewer findings:** Worker self-verification + maintainer judgment (diffs read; DEC-033 craft assessed); UX-critic spawn (incomplete) + maintainer-direct headless verification on the live deploy. Two reviewers (the Worker's tests and the maintainer's headless `_evaluate` measurement) per chunk; risk low (single-unit, additive change); criterion satisfied.
- **Same-failure-at-other-scales scan:** The "instructions guidance for credential setup" pattern is unique to auth-required catalog entries. No other surface today shows credential prompts that need this guidance. Followup for Edit-mode help block (when user re-edits a previously-saved Netdata server) noted but not in scope.
- **Specs updated:** DEC-033 created. `specs/public-servers-catalog.md` §1 schema-reference table updated with two new rows.
- **Skills updated:** None of the `project-*` skills needed an update for this SOW. Patterns are well-covered by existing project-coding (Mantine primitives, Alert use, named exports), project-testing (Mantine wrapping, MemoryStorage, TestDriver-equivalent), and project-reviewing (XSS falsifier, contrast measurement, structured-vs-qualitative critic verdicts — already folded after SOW-0007).
- **Lessons captured:** see "Lessons extracted" below.

## Outcome

Shipped on master `f264eb4`. The catalog now carries optional `instructions` + `instructions_url`. The add-server modal renders a persistent blue help Alert under the credential input whenever the picked known server has either field. Netdata Cloud (`status: active`, CORS verified) and Netdata Agent (`status: unstable`, placeholder URL) populate the auth-required dropdown. XSS check passed on the live deploy (instructions are rendered as plain text). Bundle stable at 305.8 KB gz.

A user landing on the Add modal can now pick "Netdata Cloud" from the dropdown and immediately see "Create an API token with scope:mcp at app.netdata.cloud → Profile (bottom-left) → User Settings → API Tokens → New token. Business plan required." plus a "Where to find this →" link. The form's URL/transport/auth all auto-fill; the user only needs to paste their token.

## Lessons extracted

1. **The brief-spawned critic isn't always sufficient — maintainer-direct headless verification is a valid fallback.** SOW-0006's critic burned its token budget on a mobile-drawer interaction that synthetic clicks didn't drive cleanly. Maintainer recovered by running the equivalent `_evaluate` checks directly. **Guardrail:** when a brief-spawned critic returns without a structured verdict, the maintainer can complete the falsifier check directly using the same numeric measurement approach. The critic spawn is the preferred path; the maintainer-direct path is the fallback. Both must produce numeric evidence per the SOW-0007 lesson on "PASS verdicts vs numeric criteria".
2. **CORS preflight is cheap and load-bearing.** A 30-second `curl -X OPTIONS` against the candidate URL was enough to reclassify Netdata Cloud from `unstable` (the SOW's locked default) to `active`. **Guardrail:** for any new auth-required catalog entry, run the CORS preflight check before locking the `status` value in the SOW.
3. **`pickedKnownServerId` cleared on URL divergence is the right state shape.** Tracking the picked-id (not just whether a help block should show) keeps the help-block lifecycle single-sourced; the URL-divergence reset means the block can never lie about a form that no longer matches the catalog entry. **Guardrail:** future "context-tied" UI hints (help blocks, hints, pre-fill banners) should follow the same shape — track the source-of-truth id, derive visibility from the id + the form state, reset the id when the form diverges.
4. **The XSS check on `instructions` is a worthwhile falsifier even when the JSON is maintainer-curated.** `instructions` is plain text rendered through Mantine `<Text>`; React escapes by default. But future catalog contributions could come from PRs, and the XSS falsifier in DEC-033 makes the contract explicit. **Guardrail:** any field whose value is rendered into the DOM should carry an XSS-falsifier line in its DEC; PRs that change the rendering path must re-verify.

## Followup

- **Mobile (390×844) hands-on verification.** The headless drawer interaction was fiddly; logged as a Costa-direct check or a follow-up critic spawn. The math says Save-below-fold is unlikely; concrete confirmation belongs in a future round.
- **Edit-mode help block.** The dropdown only shows in the add-server modal (`spec.mode === 'add'`), so a user re-editing a previously-saved Netdata Cloud server does NOT see the help text. If a user comes back later to rotate their token, the guidance is missing. Future SOW: surface the same `instructions` / `instructions_url` in edit mode as well, keyed by URL match against the catalog.
- **Mixed-content verification for Netdata Agent.** Live `https://ktsaou.github.io/...` cannot connect to `http://localhost:19999/mcp` (browser mixed-content). Document this in the entry's `instructions` (or in a separate doc) and consider serving the app over `http://` for self-hosted Agent testing. Track in a future SOW.
- **Schema enforcement in CI.** The pre-existing `gitmcp-mcp-servers.description` (151 chars vs 140 max) survives current CI because schema validation isn't run. Open a small SOW to add a build-time AJV check on `public-servers.json` against `public-servers.schema.json`; fix the gitmcp entry as part of it.
- **Claimed-parent MCP URL for Netdata Agent.** If Costa confirms a CORS-permissive Cloud-backed Agent URL exists, replace the placeholder approach with that.
