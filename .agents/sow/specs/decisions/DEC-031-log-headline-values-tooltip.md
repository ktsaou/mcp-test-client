# DEC-031 — Log headline values tooltip (2026-04-26)

**Problem.** Costa returned with a third UX gap on the live log:

> The tooltip in the log are still wrong. The problem is that when the
> log is narrow, the user cannot see the VALUES (tool name, size,
> tokens, duration). The goal is to show the VALUES in the tooltip,
> when hovering. Be careful: this is needed to the whole log header
> line except the buttons that each line has.

This is the half-undo of DEC-029. The DEC-014 chip-fold work hides
metric chips behind copy/save as the panel narrows; the original
fix surfaced the values via a native HTML `title=` attribute on the
headline div. DEC-029 dropped that native title to kill double
tooltips — but the values-on-hover affordance went with it. Net:
on a narrow log, the user cannot see the values at all without
expanding the row, and Costa specifically wants hover to suffice.

The fix: a single Mantine `<Tooltip>` wrapping the headline's
**values region** (chev / direction glyph / timestamp / method
title / chip area), but NOT the action buttons. Action buttons keep
their own per-button Mantine tooltips. No native HTML `title=` is
introduced — no double-tooltip regression of DEC-029.

## What ships

In `src/ui/log-panel.tsx`:

1. **Refactor the wire-row headline DOM** so the values and the
   actions are siblings rather than the actions living inside the
   headline. Today (post-DEC-029):

   ```tsx
   <div className="log-row__headline" onClick={...}>
     <chev /><dir /><ts /><title />
     {isResp && <chips />}
     {pairedId && <pair-jump-action />}
     <copy-save-actions />
   </div>
   ```

   Becomes:

   ```tsx
   <div className="log-row__headline">
     <Tooltip label={valuesString} withinPortal openDelay={350}>
       <div className="log-row__values" role="button" onClick={...}>
         <chev /><dir /><ts /><title />
         {isResp && <chips />}
       </div>
     </Tooltip>
     {pairedId && <pair-jump-action />}
     <copy-save-actions />
   </div>
   ```

   The `.log-row__values` div carries the existing role=button + click
   handlers (toggle + onSelect + drag-select guard). The action
   buttons sit OUTSIDE the Tooltip subtree, so each button keeps its
   own Mantine `<Tooltip>` for "Copy as JSON" / "Save as .json file"
   / "Jump to the paired entry" labels.

2. **CSS update** (`log-panel.css`): `.log-row__values` becomes a
   flex container with `flex: 1 1 auto` and `min-width: 0` so the
   title can ellipsis-truncate without pushing the actions out.
   The right-edge alignment of action buttons (DEC-014) must still
   hold across all `data-chip-level` widths.

3. **Build the values string** per row kind:
   - **Outgoing request:** `formatHeadline(headline)`
     (e.g., `tools/list` or `tools/call · resolve-library-id`).
   - **Incoming response:** `formatHeadline(headline) · <bytes> · <durationMs>`,
     plus `· ~<n> tokens` if tokens are loaded (else omit, never show
     "pending" or "n/a" — the visible expanded body has those).
   - **Notification:** `formatHeadline(headline) · notification — no paired response`.
   - **System row:** `<entry.text>` (single tooltip on the whole headline
     when text might truncate at narrow widths).

4. **System-row headline tooltip.** The system row has no action
   buttons; wrap the whole `.log-row__headline` in `<Tooltip
label={entry.text}>`. The drag-select guard still applies.

## Anti-cases

- **No double tooltips.** The pair-jump, copy, and save buttons MUST
  remain OUTSIDE the values-Tooltip subtree. Hover any of those
  buttons → exactly ONE tooltip appears (the button's own Mantine
  Tooltip, never two stacked).
- **No native HTML `title=` reintroduced.** This DEC fixes Costa's
  values gap _without_ re-creating the bug DEC-029 closed.
- **Drag-select still works.** The values div keeps the
  `isSelectionDragInside` guard so text-drag mouseups don't
  trigger the click handlers (DEC-030 anti-case).
- **Click target unchanged.** The user clicks anywhere on the values
  region and gets the same toggle + anchor behaviour as today
  (DEC-030's headline click).
- **Action buttons keep their existing tooltips.** "Copy as JSON",
  "Save as .json file", "Jump to the matching response" remain on
  their own buttons, NOT on the values region.
- **Tooltip openDelay 350 ms** to avoid firing on quick mouse passes.
  Not 0 (annoying), not 1000 (sluggish); the standard hover-intent
  threshold.

## Falsifier

The DEC has shipped successfully if, on the live deploy:

1. **Narrow log shows values on hover.** Resize the log panel to its
   narrowest width (chip-level 3 — only timestamp + method + actions
   visible). Hover a response row's headline values area. After
   ~350 ms a Mantine tooltip appears with the full method, bytes,
   and duration. Move mouse off — tooltip disappears.

2. **Action buttons keep their per-button tooltips.** From the same
   narrow state, hover the `⎘` copy button. Exactly one tooltip
   appears with text "Copy as JSON". Hover the `⤓` save button →
   one tooltip "Save as .json file". Hover `↔` →
   "Jump to the matching response". No double tooltip on any of
   these.

3. **No native HTML `title=` reintroduced.**
   `git grep -nE 'title=\{[^}]*\}|title="[^"]*"' src/ui src/state`
   returns only React component-prop matches (Modal/Alert/EmptyState/
   Drawer/Tooltip `label=` is fine; `title=` on raw DOM elements is not).

4. **System rows show full text on hover.** Hover a system row whose
   text is longer than the visible width (e.g., narrow + a long
   "resources/templates/list unavailable: MCP error -32601: ..."
   message). Tooltip shows the full text.

5. **Click + drag-select behaviour preserved.** Click on the values
   region toggles expand AND anchors cursor (DEC-030). Drag-select
   text inside the values does NOT toggle and does NOT anchor.

6. **Critic-gated under DEC-002.**

## Advisor sign-off

UX critic (visible-surface change to log row interaction). Particular
attention to: the right-edge alignment of action buttons across all
chip-levels (DEC-014 must still hold), and the no-double-tooltip
invariant (DEC-029 must still hold).

## Status

Closed — shipped as v1.2.6 (Worker commit `196bafc`, release
`a6c0b14`). **Costa-verified** on the live deploy: he tested it
himself and confirmed the values-on-hover affordance works at
narrow widths without re-introducing DEC-029's double-tooltip
regression. Costa's sign-off supersedes the critic-gate under
DEC-002 — when the user has personally exercised the surface and
confirmed the contract, that is the strongest possible advisor
pass.

Third Costa-feedback ship of the day on the same log-row surface:
DEC-029 (no double tooltips), DEC-030 (click anchors cursor),
DEC-031 (values on hover). Each shipped through the framework
two-step (Worker brief → ship).

The cross-browser server-id portability candidate that was
previously holding the DEC-031 slot bumps to **DEC-032**.
