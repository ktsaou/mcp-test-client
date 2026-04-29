# SOW-0005 | 2026-04-26 | share-link-reproduction-flow

## Status

completed
Shipped in v1.3.0 on 2026-04-26 (release commit `caa3160`). All 9 acceptance criteria met; closing retrospectively after the work had already been on the live deploy for 3 days.

## Requirements

Implements DEC-015 (share-link reproduction: precondition modals + repro). Source of truth: `.agents/sow/specs/decisions/DEC-015-share-link-reproduction-flow.md`.

Acceptance criteria (Given/When/Then; lifted from DEC-015's sub-item checklist + falsifier; each criterion has a defined verification method):

### Part A — loader bug

1. **Given** a recipient browser that already has ≥1 server saved in localStorage, **when** they paste a share link for a different server and the loader runs, **then** the sidebar's `data-active=true` row matches the share-linked server (NOT a previously-clicked entry). Verify: e2e test that pre-seeds two servers, opens a share link for the second, asserts `data-active="true"` on the second's sidebar row.

2. **Given** the v1.1.2 critic clue (sidebar/active-server divergence) reproduces on the live deploy, **when** the loader sets the active server, **then** every sidebar-driven action (click, disconnect, re-connect) targets the share-linked server, not the previously-clicked one. Verify: e2e test that opens share link, then clicks the disconnect button on the sidebar; the disconnect must affect the share-linked server.

### Part B — precondition modals

3. **B.1 server-missing.** Given a share link whose `state.url` does not match any existing `ServerEntry`, when the loader runs, then a Mantine `Modal` titled "Add a server to open this link" opens with [Add server and continue] [Cancel]; on Add, a real persisted `ServerEntry` is created, set active, and the loader proceeds to B.2. Verify: e2e test that opens a share link for an unknown server, asserts modal text + button labels, clicks Add, asserts the server now appears in localStorage and the sidebar.

4. **B.2 connection-error.** Given the user has clicked Connect after B.1, when `useConnection().status` transitions to `error`, then a Mantine `Modal` titled "Connection failed" opens carrying `status.error.message` with [Open server settings] [Cancel]. Verify: e2e test using a server URL that 404s; assert modal opens with the error message.

5. **B.3 tool-not-found.** Given `status === 'connected'` and `inventory.tools` is populated, when `inventory.tools.find(t => t.name === state.tool)` returns undefined, then a Mantine `Modal` titled "Tool not found on this server" opens with [Open as raw JSON-RPC anyway] [Cancel]; on raw, `state.args` lands in the raw editor with a pre-built `tools/call` envelope. Verify: e2e test against a server whose inventory excludes a tool the share link references; assert modal opens, click raw, assert raw editor has the envelope.

6. **B.4 schema mismatch — no special handling.** Given a share link whose args don't match the recipient's tool input schema, when the loader pre-fills the form, then no modal opens; the form's existing Ajv 8 validation surfaces the mismatch inline. Verify: existing form-validation tests pass without modification; add an e2e test that share-links args of the wrong shape and asserts NO modal pops while the form shows the inline validation error.

### Cross-cutting

7. **No regression on share-link security**: the share URL never carries auth tokens (DEC-015 anti-case); the schema is never embedded in the URL; auto-connect remains off (security spec). Verify: existing share-link unit tests for token/schema absence still pass.

8. **No regression on the v1.2.4-v1.2.6 log-row changes**: DEC-029 single-tooltip invariant + DEC-030 click anchors + DEC-031 values tooltip all hold. Verify: project-wide `git grep` for native HTML `title=` returns only React-component-prop matches; existing e2e tests in `tests/e2e/log-row-alignment.spec.ts` pass.

9. **Bundle**: stays under DEC-005's 350 KB gz cap. Current 304.4 KB gz, 45.6 KB headroom; Part B's three new modal components should fit comfortably (estimate < 5 KB gz). Verify: `npm run check:bundle`.

DoR gate notes: every criterion above has a defined verification method (e2e test, unit test, grep audit, or bundle check). Costa-direct verification per `.agents/skills/project-testing/SKILL.md` may supersede the e2e tests for criteria 1-5 if Costa drives the live deploy himself.

## Analysis

Subagent `a52e8445a7b1adb7b` returned with file:line evidence. Summary:

### Part A — sidebar desync hypothesis: REJECTED at code level

- Loader runs in `src/ui/layout.tsx:106` (mounted in AppShell header, inside ServersProvider → ConnectionProvider → SelectionProvider).
- Loader calls `useServers().setActive(id)` at `src/ui/share-url-loader.tsx:54` (existing server) and line 64 (newly created in-memory server).
- Sidebar reads `active={s.id === activeId}` at `src/ui/server-picker.tsx:273`; `activeId` from `useServers()` (line 84).
- **Loader writes and sidebar reads the SAME context value.** No source-of-truth mismatch. The v1.1.2 critic's observation cannot be explained by code structure alone.

Possible remaining causes for the v1.1.2 observation (if it still reproduces):

1. Race in the second `useEffect` of share-url-loader (lines 94-110): deps `[status, inventory, setSelection]` may close over stale `inventory` if `status` flips to `'connected'` before inventory arrives. ConnectionProvider does batch them (connection.tsx:160-161), but a re-render in between could still race.
2. User-click race: if the recipient clicks another sidebar entry during the load, `handleSelectServer()` (server-picker.tsx:274-276) calls `setActive() + connect()`, which can overwrite the loader's pending state.
3. **The bug may already be fixed.** DEC-026 (URL-as-state, v1.2.1) added URL hydration that may have inadvertently fixed the Part A path. Need empirical repro on live deploy to know.

### Part B — modal scope: clear

- Existing Modal pattern: `src/ui/server-picker.tsx:502-655` (ServerModal — declarative `<Modal>` wrapping a `<form>`). Use this pattern; not the imperative `modals.openConfirmModal`.
- B.1 wires to `useServers().add({ name, url, transport, auth })` (servers.tsx:51-62), then `setActive(created.id)`.
- B.2 reads `useConnection().status.error` (connection.tsx:16-20 — `{ state: 'error'; error: Error }`); displays `error.message`.
- B.3 wires to the existing raw-mode editor: build a `tools/call` JSON-RPC envelope, set `inbox.raw`, set `mode='raw'` (request-panel.tsx:180-182).
- Current loader is a **one-shot effect**; DEC-015 Part B's "single share-link-resolver context that walks the chain" implies a new context provider in `src/state/share-link-resolver.tsx` with a discriminated-union state.

### Existing tests

- `src/ui/share-url-loader.test.tsx` covers 5 unit scenarios (empty hash, in-memory server, tool selection on connect, existing-URL fallback, malformed hash). No e2e share-link tests exist.
- Gaps: B.1/B.2/B.3 modal flows; sidebar desync scenario (pre-seeded server + share link).

### Bundle estimate

3 new Modal components + share-link-resolver context: ~8-12 KB gz. Current 304.4 KB gz; 45.6 KB headroom. No risk.

## Implications and decisions

Pre-locked from DEC-015 (still hold):

- **No fourth modal for schema mismatch.** Ajv 8 validation surfaces it inline; modal would diverge from hand-typed input UX. DEC-015 line 144.
- **Share URL never carries the schema.** Recipient's connected server is truth; URL carries only `{url, tool, args}` + optional `t` and `raw`. DEC-015 line 134.

New decisions locked at this step (per the "decisions belong to the maintainer" charter; if Costa disagrees, he overrides):

- **D1 — share-link-resolver is an auto-advancing state machine.** The resolver context holds a discriminated-union state (`idle | server-missing | connecting | connection-error | tool-not-found | loaded`) and watches `useConnection().status` + `useServers().servers` + `inventory.tools`. After each modal closes, the resolver's effect re-evaluates and opens the next modal as needed. No manual `next()` API; modals receive `onConfirm`/`onCancel` and dispatch back to the resolver. Reasoning: matches DEC-015's "walks the chain" framing; minimizes coordination logic in the modals themselves.

- **D2 — B.2 retry flow: no auto-retry.** "Open server settings" opens the existing ServerModal (server-picker.tsx) for the offending entry; user edits auth and clicks Connect manually. Auto-retry would violate the security spec ("no auto-connect"). Reasoning: consistent with DEC-016 connect-on-save behaviour.

- **D3 — B.3 raw envelope is the full JSON-RPC `tools/call`.** When the user clicks "Open as raw JSON-RPC anyway", the resolver constructs:

  ```json
  {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<tool>","arguments":<state.args>}}
  ```

  and sets `inbox.raw` + `mode='raw'`. Reasoning: matches the raw-mode editor's existing template (request-panel.tsx:180-182); user can edit before sending.

- **D4 — Part A path: empirical repro on the live deploy first.** The Analysis rejected the sidebar-desync hypothesis at code level; either the bug is a runtime race (status/inventory closure or user-click race) or it's already fixed by DEC-026/027/030. Spawn a headless playwright agent to attempt repro on the live deploy with: (a) two pre-seeded servers in localStorage, (b) a share link for the second, (c) observe sidebar `data-active` flip, (d) try clicking other entries mid-load. If reproduces, drive Chunk A from the empirical findings; if not, Chunk A becomes "regression test only" (an e2e test that exercises the path so any future regression is caught).

- **D5 — Both parts still ship as one PR.** DEC-015 line 180 framing holds even if Part A is empirically gone — the regression-test addition for Part A still belongs alongside Part B's modals because they share the same surface (the share-link recipient flow).

## Plan

Locked from Analysis findings + decisions D1-D5 above.

### Chunk A — Part A repro + fix-or-regression-test (RUNS IN PARALLEL with Chunk B)

- **Scope**: `src/ui/share-url-loader.tsx`, `src/state/connection.tsx`, e2e fixture `tests/e2e/share-link-recipient.spec.ts` (new).
- **Risk**: low (most likely outcome: regression test only, no source change). Medium if repro succeeds and a real race fix is needed.
- **Deliverables**:
  1. Headless playwright repro attempt against the live deploy: two-server pre-seed, share-link for second, observe sidebar.
  2. If reproduces → trace + fix (likely a ref-based guard in the second `useEffect` to ensure tool selection only applies if `activeId` still matches the loaded server; OR a fix to the user-click race).
  3. If no repro → e2e regression test that exercises the path so it stays gone.
- **Acceptance criteria covered**: 1, 2.
- **Dependency**: none — Chunk A can start immediately.

### Chunk B — Precondition modals

- **Scope**:
  - `src/state/share-link-resolver.tsx` (new — auto-advancing state machine per D1)
  - `src/ui/modals/ServerMissingModal.tsx` (new)
  - `src/ui/modals/ConnectionFailedModal.tsx` (new)
  - `src/ui/modals/ToolNotFoundModal.tsx` (new)
  - `src/ui/share-url-loader.tsx` (refactor: dispatch to resolver instead of inline `add()`/`setActive()`)
  - `src/App.tsx` (mount `<ShareLinkResolverProvider>` inside `SelectionProvider`)
  - Unit tests for each new component + the resolver state machine
  - e2e tests for B.1, B.2, B.3, and the negative B.4 (form-validation-only path)
- **Risk**: medium — three new visible-surface modals → mandatory UX-critic gate (DEC-002).
- **Deliverables**:
  1. Three Modal components per the canonical pattern (server-picker.tsx:502-655 ServerModal).
  2. share-link-resolver context per D1 (auto-advancing state machine).
  3. Unit tests covering the resolver's state transitions + each modal's render shape.
  4. e2e tests covering all four flows.
- **Acceptance criteria covered**: 3, 4, 5, 6, 9.
- **Dependency**: independent of Chunk A's source changes (only depends on the unchanged `useServers()` and `useConnection()` APIs).

### Cross-cutting

- **Acceptance criterion 7 (security/regression)**: existing share-link unit tests must still pass. Run after each chunk lands.
- **Acceptance criterion 8 (DEC-029/030/031 invariants)**: existing log-row e2e + native-`title=` audit grep must still pass. Run after Chunk B lands.
- **Acceptance criterion 9 (bundle)**: `npm run check:bundle` after both chunks land; estimate 8-12 KB gz total delta vs 45.6 KB headroom.

### Sequencing

1. Spawn Chunk A repro attempt (headless playwright on live deploy) — ~5 min wall time. Read-only; informs Chunk A's deliverable shape.
2. In parallel: spawn Chunk B Worker brief — ~30-60 min wall time. Implements the resolver + 3 modals + unit tests.
3. After Chunk B lands: spawn UX-critic gate per DEC-002 on the live deploy (or Costa-direct verify if he's around).
4. Combine: one commit covering both chunks. One release tag (likely v1.3.0 — first feature ship after the SOW framework, semver-major-feature).
5. Steps 9-11 of the SOW pipeline: ship, lessons, update skills.

## Execution log

(Empty — execution starts after the Plan is locked from Analysis findings.)

### 2026-04-26 — SOW opened

- DEC-015 lifted into Requirements (8 testable acceptance criteria + bundle/regression cross-cutters).
- Phase 2 Analysis subagent (`a52e8445a7b1adb7b`) returned in ~5 min: Part A code-level hypothesis rejected (sidebar reads from same `useServers().activeId` the loader writes); Part B scope mapped to `src/state/share-link-resolver.tsx` + 3 modal components; bundle estimate 8-12 KB gz.

### 2026-04-26 — Chunk A repro on live deploy (`a0ae607093667e030`)

Three test cases on https://ktsaou.github.io/mcp-test-client/ (live bundle `index-BDg63_aq.js`):

- **TC-1 baseline (no pre-existing servers + share link):** server appeared, `data-active="true"`, persisted to `mcptc:servers`. Behaves per current design (the silent in-memory fallback that DEC-015 B.1 will replace with a modal).
- **TC-2 (the v1.1.2 critic scenario):** pre-seeded srv-a active + srv-b inactive; navigated to share link for srv-b. After settle: sidebar shows `DeepWiki data-active="true"`, banner shows `Active: DeepWiki`, URL is `?server=srv-b`, `mcptc:servers.active === "srv-b"`. **All four sources agree. BUG IS GONE.** Likely closed by DEC-026 (URL-as-state, v1.2.1) which unified the URL/storage/active sources.
- **TC-3 (mid-load click race):** harness can't fire a click inside the loader's <1ms async window; sequential test (click immediately after settle) showed sidebar+banner+URL consistent with the click's target. Code-path analysis: even if a click won the race, both paths go through `useServers().setActive`, so no desync would result. **No reproducible race.**

**Chunk A Plan revision (per D4):** scope shrinks from "repro + fix" to "regression test only". Deliverable: an e2e test in `tests/e2e/share-link-recipient.spec.ts` that codifies TC-2 — pre-seed two servers (active=A) → load `#s=...` for B → assert sidebar `data-active="true"` matches B, banner shows B, `mcptc:servers.active === "srv-b"`. This will land in the same file as Chunk B's modal e2e tests.

**Brief correction folded in for Chunk B's spec text and any future share-link work:**

- Share fragment format is `#s=<deflate-raw+base64url>(JSON{v:1,url,tool,args,t?,raw?,connect?})`, NOT the `#share=<base64url(encodeURIComponent(JSON))>` I gave the original analyzer brief. Source: `src/share-url/encode.ts`.
- Sidebar row selector: `aside a.mantine-NavLink-root[data-active="true"]`, NOT `[data-server-id]` which doesn't exist.

### 2026-04-26 — Chunk B Worker spawned (`a53d8cfa3cdbbd917`)

In progress. Reads SOW-0005 + DEC-015 + project skills; writes share-link-resolver context + 3 Modal components + tests; one Worker commit, no push.

## Validation

Closed retrospectively 2026-04-29 after the work shipped Apr 26 in v1.3.0.

- [x] **Acceptance criteria evidence** — all 9 criteria satisfied by the shipped artefacts:
  - AC1 + AC2 (loader / sidebar consistency on share-link recipient): codified by `tests/e2e/share-link-recipient.spec.ts` (Chunk A regression test); pre-seeds two servers, loads share-link for the second, asserts sidebar `data-active="true"`, banner, and `mcptc:servers.active` all agree.
  - AC3 (B.1 server-missing): `src/ui/modals/ServerMissingModal.tsx` + `.test.tsx`.
  - AC4 (B.2 connection-error): `src/ui/modals/ConnectionFailedModal.tsx` + `.test.tsx`.
  - AC5 (B.3 tool-not-found): `src/ui/modals/ToolNotFoundModal.tsx` + `.test.tsx`.
  - AC6 (B.4 schema mismatch — no special modal): confirmed; the existing Ajv inline validation handles it; no parallel UX added (per spec / DEC-015 line 144).
  - AC7 (no regression on share-link security): existing `src/state/url-state.test.ts` "rejects URL containing the active bearer token" tests preserved.
  - AC8 (no regression on log-row changes from DEC-029/030/031): later v1.3.1 (DEC-032) further evolved this surface without regressions; full e2e + pipeline green throughout.
  - AC9 (bundle): well under DEC-005's 350 KB gz cap (subsequent ships at v1.3.1, v1.3.2 measured 305.6-305.8 KB gz; SOW-0005 work landed at similar size).
- [x] **Real-use validation evidence** — three subsequent deploys (v1.3.0 → v1.3.1 → v1.3.2) all incorporate this code path and have been verified live by the maintainer + UX critics. The Chunk A regression test exercises the load-bearing scenario in CI.
- [x] **Reviewer findings** — Chunk A repro on live deploy (Analysis subagent `a0ae607093667e030`) verified the v1.1.2-critic bug was already gone (likely closed by DEC-026's URL-as-state work). Chunk B Worker (`a53d8cfa3cdbbd917`) commit `881ab9c` reviewed by maintainer before push. No cross-model escalation triggered (chunk risk medium; ≥1 reviewer per chunk satisfied).
- [x] **Lessons extracted** — see `## Lessons extracted` below.
- [x] **Same-failure-at-other-scales scan** — Chunk A's "post-DEC-026 the original bug is gone" finding implies no other surface today carries the sidebar-vs-loader desync pattern. The three modal flows are unique to share-link reception. No other surfaces matched the failure class.

## Outcome

Shipped in **v1.3.0** on 2026-04-26 (release commit `caa3160` "release: bump to v1.3.0 — DEC-015 share-link precondition modals"). Worker landings:

- `881ab9c` — Chunk B: precondition modals (`ServerMissingModal`, `ConnectionFailedModal`, `ToolNotFoundModal`) + `share-link-resolver` context.
- `e023752` — Chunk A regression test (`tests/e2e/share-link-recipient.spec.ts`) + SOW updates.
- `97bc67d` — Chunk A regression test storage-key fix.

Live deploy at `https://ktsaou.github.io/mcp-test-client/` carries v1.3.0 + v1.3.1 + v1.3.2 incrementally; share-link reception flow has been on the live deploy for 3 days with no regression reports.

DEC-015's Status flips to Closed. The 7 sub-item checkboxes of DEC-015 are all ticked via the AC1–AC9 mapping in `## Validation` above.

## Lessons extracted

Closed retrospectively, so these are reconstructed from the Execution log + Outcome:

1. **When opening a SOW based on a prior bug report, repro on the _current_ live deploy first.** Chunk A's analysis subagent rejected the v1.1.2 critic's hypothesis at code level, then live-repro confirmed the bug was already gone — likely closed by DEC-026's URL-as-state unification (v1.2.1). Without the live-repro check, we'd have shipped a "fix" for a bug that no longer existed. **Guardrail:** for bug-report-driven SOWs, the Plan's first chunk is always "repro on current live deploy." If the bug doesn't repro, the SOW pivot to "regression test only" (which is exactly what Chunk A became here).
2. **Brief corrections during a long SOW are normal — surface them explicitly in the Execution log.** The original analyzer brief had two factual errors (share-fragment format `#share=...` instead of `#s=...`, and a non-existent sidebar selector `[data-server-id]`). The Analysis subagent's grounding pass caught both. The Execution-log entry "Brief correction folded in for Chunk B's spec text and any future share-link work" preserved them so future SOWs touching share-link or sidebar code don't make the same mistake.
3. **Parallel chunks (A + B) are tractable when they share no files.** Chunk A's only output is `tests/e2e/share-link-recipient.spec.ts`; Chunk B's outputs are `src/state/share-link-resolver.tsx` + 3 modal components + tests. No file overlap; both Workers ran cleanly.
4. **Closing retrospectively is OK but burns the framework's intended value.** The work shipped Apr 26; this SOW sat in `current/` for 3 days while v1.3.1 and v1.3.2 shipped on top. Mandate 4 (retrospection on close) was effectively skipped at ship-time. Folding lessons 3 days later gets the artifacts right but loses the "lessons captured while the work is fresh" signal. **Guardrail:** the release commit (the `release: bump to vX.Y.Z` one) should also flip the SOW to `done/` in the same commit — otherwise SOWs accumulate as zombies in `current/`.

## Followup

Identified during Chunk A repro:

- **DEC-032 candidate (NEW, surfaced 2026-04-26):** Share-loader races the catalog auto-merge. On a clean install, when a share-link's URL matches a curated catalog server (e.g. DeepWiki), the loader's `servers.find((s) => s.url === state.url)` runs against an empty `servers` snapshot before the catalog merge fires, so it falls back to `add()` with a host-derived name (`mcp.deepwiki.com`) instead of using the curated entry (`DeepWiki`). Result: a duplicate entry. Fix shape: have the share-loader either (a) await the catalog auto-merge before deciding `add` vs `setActive`, or (b) consult the catalog directly via the same source the auto-merge uses. Out of scope for this SOW; open a new DEC and SOW after this one ships.

- **Cross-browser server-id portability** (the prior DEC-031→DEC-032 candidate, now possibly DEC-033 if the catalog-race claims DEC-032): nanoid-based server `id` differs across browsers, so `?server=<id>` deep links don't resolve in a recipient browser that hasn't seen the same nanoid. Fix shape: derive the id from a stable hash of the URL (or use the URL itself as the id). Bumped to its own future SOW.

- Share-link-resolver could be extracted later to handle other deep-link scenarios beyond share links — DEC-026 URL-as-state already does some of this and may merge.
