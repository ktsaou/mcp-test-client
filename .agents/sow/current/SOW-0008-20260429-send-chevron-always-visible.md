# SOW-0008 | 2026-04-29 | send-chevron-always-visible

## Status

in-progress
Maintainer-locked decisions captured 2026-04-29. Worker to be briefed. Bug verified at code level (no live-repro needed — the conditional is unambiguous).

## Requirements

### Purpose

The Send split-button's chevron dropdown unmounts when the user switches from form mode to raw mode. The button also reshapes (flat-right corners only when chevron is present), so the toolbar layout shifts as a side effect. UX is jumpy and the chevron's affordance disappears for raw mode where it could host useful raw-only actions.

### User request (verbatim)

> bug: the send dropdown on tools, is not there when switching from form to raw. check it

### Assistant understanding

- **Root cause** (`src/ui/request-panel.tsx:549`): the entire `<Menu>` is conditionally rendered behind `{canSendForm ? ... : null}` where `canSendForm = mode === 'form' && formSchema !== null` (line 381). In raw mode `canSendForm` is false, so the chevron + dropdown unmount.
- **Side effect** (`src/ui/request-panel.tsx:541-542`): the Send button's right-side corners are conditionally squared on `canSendForm` — they revert to default (rounded) when the chevron is gone. The button shape jumps between form and raw.
- **Existing chevron menu** has one functional item ("Send without validation" via `sendFormCall({ skipValidation: true })`) plus a disabled descriptor row. That item is form-mode-only by design (DEC-019 — validation-bypass for malformed-input testing).

### Acceptance criteria

1. **Chevron always visible** — the chevron + dropdown remain mounted in both `form` and `raw` modes whenever `mode === 'raw' || canSendForm`. Verify: e2e or component test that switches from form to raw and asserts the chevron `<button aria-label="More send options">` is still in the DOM.
2. **Send button shape stable across modes** — the Send button's right-side corners stay flat (square) in both modes, since the chevron is always attached. No visual jump on mode toggle. Verify: same test asserts `borderTopRightRadius === 0 && borderBottomRightRadius === 0` for the Send button regardless of mode.
3. **Form-mode menu items unchanged** — when in form mode, the dropdown still shows "Send without validation" + the existing disabled descriptor row. No regression on DEC-019.
4. **Raw-mode menu items added**:
   - **"Format JSON"** — parses `text` with `JSON.parse`, re-stringifies with `JSON.stringify(parsed, null, 2)`, replaces the textarea content. If parse fails, the menu item is disabled (or shows a parse-error sub-label). Useful when the user has pasted minified JSON or is editing.
   - **"Reset to template"** — re-initializes the textarea with the canonical `tools/call` envelope for the currently-selected tool (the same template the form→raw fallback uses on first mount; locate the existing template generator at `src/ui/request-panel.tsx:51-82`). Disabled when no tool is selected.
5. **Disabled descriptor row** — each mode keeps its single disabled descriptor row matching the active items (e.g. "Reformat the JSON-RPC payload in place" / "Replace the editor with the tool's default tools/call envelope" for raw; existing "Bypass the input-schema check for this send only" for form).
6. **Both modes' chevron disabled when `disabledByConn`** — same rule as today (status not connected, or sending). The chevron's `<ActionIcon>` already takes `disabled={disabledByConn}`.
7. **No regression on the keyboard / command-palette path** — `useRegisterRequestActions` (lines 411-426) keeps publishing `send`, `sendSkipValidation`. The new raw-mode actions don't need palette wiring for this SOW (Followup if useful).
8. **Bundle** — stays under DEC-005's 350 KB gz cap (currently 305.8 KB gz, 44.2 KB headroom).

## Analysis

Sources:

- `src/ui/request-panel.tsx:381` — `canSendForm` definition.
- `src/ui/request-panel.tsx:534-547` — Send button with conditional border-radius.
- `src/ui/request-panel.tsx:549-588` — chevron Menu conditional.
- `src/ui/request-panel.tsx:51-82` — JSON.stringify template generators (the raw-mode initial template comes from here; Worker should use the same helper for "Reset to template").
- `src/ui/request-panel.tsx:170-182` — `setText / setMode` paths on tool selection / share-link inbox.
- DEC-019 (split-button + form-validation gate) — the original justification for the chevron. Preserved.
- DEC-002 (UX-critic mandatory for visible-surface changes) — applies; critic gate after deploy.

The fix is small (single-file UI change + tests). Risk: low.

## Implications and decisions

Maintainer-locked 2026-04-29 (per project AGENTS.md "decisions belong to you"; project-internal UX call):

### D1 — Always render the chevron (form AND raw)

Rejected: the alternatives "render chevron only in form mode" (current behaviour, the bug Costa is reporting) and "remove the chevron entirely" (breaks DEC-019's validation-bypass affordance). Always-visible wins on UX consistency: the Send button doesn't reshape on mode toggle, and the chevron becomes a stable affordance for mode-specific extra actions.

### D2 — Raw-mode menu = "Format JSON" + "Reset to template"

Both are useful, low-risk, raw-specific actions. Format-JSON handles the common case of pasted minified JSON or post-editing cleanup. Reset-to-template is the escape hatch when the user has scrambled the envelope structure. Form mode keeps "Send without validation" as today; the two surfaces don't share items.

### D3 — Send button shape always flat-right

Drop the conditional border-radius. The chevron is always there, so the Send button is always flat-right joined to it. Removes the visual jump.

### Risk register

- Mantine `<Menu>` mounted with disabled-only items can render weird; need to ensure at least one item is interactive in each mode. Both mode-specific menus have at least one interactive item, so OK.
- "Format JSON" with parse-error needs to NOT throw; wrap the JSON.parse in try/catch and disable the item OR show a parse-error sub-label.
- "Reset to template" must use the same template helper as the existing initial-mount path so the envelope shape stays canonical.
- DEC-002 critic gate after deploy.

## Plan

Single-unit, low risk. One Worker brief.

Files to touch:

1. `src/ui/request-panel.tsx`:
   - Line 381 area: keep `canSendForm` for the form-validation logic but introduce a new `canShowChevron = mode === 'raw' || canSendForm` (or simply always-true once cleaned up).
   - Lines 541-542: drop the conditional border-radius (always flat-right).
   - Lines 549-588: rework — always render the Menu; switch the dropdown contents on `mode`. New raw-mode items: Format JSON, Reset to template. Add try/catch around the JSON parse; disable the item if parse fails.
2. `src/ui/request-panel.test.tsx` (or new file): tests for the four behaviours — chevron present in form, chevron present in raw, Format JSON parses + reformats, Reset to template restores the canonical envelope.
3. NEW: `.agents/sow/specs/decisions/DEC-034-send-chevron-always-visible.md` — short ADR-lite (~25-40 lines), mirroring this SOW's "Implications and decisions". Add to `decisions/README.md` index.

Validation gates:

- Pipeline green: `npm run typecheck && npm run lint && npm test && npm run build && npm run check:bundle`.
- UX-critic on the live deploy (DEC-002 mandatory): brief targets the form↔raw toggle on a tool with a schema (e.g. Context7's `resolve-library-id`). Verify: chevron stays mounted; Send button shape doesn't shift; the two raw-mode items work (paste a minified JSON → Format → see pretty); Reset to template re-fills the envelope.
- Bundle: under 350 KB gz.

## Execution log

(To be filled when work begins.)

## Validation

(To be filled at completion.)

## Outcome

(To be filled at completion.)

## Lessons extracted

(To be filled at completion.)
