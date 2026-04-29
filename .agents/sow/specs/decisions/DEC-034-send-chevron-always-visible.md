# DEC-034 — Send chevron always visible, mode-conditional dropdown (2026-04-29)

**Problem.** The Send split-button's chevron Menu is rendered behind
`{canSendForm ? <Menu>... : null}` (`src/ui/request-panel.tsx:549`,
pre-DEC-034). When the user toggles from form to raw mode the entire
chevron unmounts, the Send button reverts from flat-right to fully
rounded corners, and the toolbar visibly jumps. The chevron's
discoverable affordance also disappears in the mode where raw-only
helpers ("format the JSON I just pasted", "give me back the canonical
envelope") would be most useful.

## Options considered

- **Render chevron only in form mode** (current behaviour, the bug
  Costa reported) — rejected. The shape jump is jarring and there is
  no place to host raw-mode editor helpers.
- **Remove the chevron entirely** — rejected. DEC-019's
  validation-bypass affordance lives there and is load-bearing for MCP
  server developers testing malformed input.
- **Always render the chevron + share items between modes** —
  rejected. The form-mode item ("Send without validation") only makes
  sense when there is a schema gating the send; surfacing it in raw
  mode would be a foot-gun.
- **Always render the chevron + mode-conditional items** (chosen).
  Send shape stays stable (always flat-right joined to the chevron);
  each mode hosts the actions that are meaningful in that mode.

## Decision

1. The chevron Menu is always mounted whenever the Send button is
   mounted. The `<Group>` wrapping Send + chevron renders both
   unconditionally.
2. The Send button's right-side corners are always square
   (`borderTopRightRadius: 0`, `borderBottomRightRadius: 0`). The
   conditional radius based on `canSendForm` is removed.
3. Dropdown contents switch on `mode`:
   - **Form mode** keeps DEC-019's "Send without validation" + its
     existing disabled descriptor row. Unchanged behaviour.
   - **Raw mode** hosts **Format JSON** (`JSON.parse(text)` then
     `JSON.stringify(parsed, null, 2)`; disabled when the editor
     doesn't currently parse — the disabled state surfaces the
     failure cheaply, we don't silently corrupt the user's text);
     **Reset to template** (re-seeds the editor with the canonical
     `tools/call` envelope for the current tool selection, reusing
     the same `templateFor()` helper that powers the initial
     form→raw fallback so the canonical shape is single-sourced;
     disabled when no tool is selected); and a single disabled
     descriptor row matching the existing form-mode visual weight.
4. Both modes' chevron remains disabled when `disabledByConn`
   (status not connected, or sending). DEC-019 + DEC-029 behaviour
   unchanged.

## Falsifier

The DEC ships successfully if, on the live deploy:

1. Toggling form ↔ raw on a tool with a schema (e.g. Context7's
   `resolve-library-id`) keeps the chevron visibly mounted in both
   modes.
2. The Send button's right-edge does not visibly reshape across the
   toggle (no rounded → square jump).
3. Form-mode dropdown still shows "Send without validation" + its
   descriptor row; clicking it bypasses Ajv validation per DEC-019.
4. Raw-mode dropdown shows "Format JSON" + "Reset to template" only.
   Pasting minified JSON and clicking Format yields pretty-printed
   JSON; pasting invalid JSON renders the Format item as disabled.
5. Reset to template restores the same envelope shape the panel
   seeds when the user first switches to raw mode (no shape drift —
   the helper is shared).
6. Bundle stays under 350 KB gz (DEC-005).

## Status

In flight — implemented under SOW-0008. UX-critic gate runs after the
maintainer cuts the live deploy (per DEC-002, mandatory for
visible-surface changes; Costa-direct verification supersedes per
`.agents/skills/project-testing/SKILL.md`).
