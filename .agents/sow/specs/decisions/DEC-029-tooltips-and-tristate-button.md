# DEC-029 — No double tooltips + tristate Connect/Abort/Disconnect (2026-04-26)

**Problem.** Two UX bugs Costa caught on the live v1.2.3:

1. **Log rows show two tooltips on hover.** The headline `<div>`
   carries a native HTML `title=` attribute (added during the
   DEC-014 squeeze work to surface chip values when chips fold) and
   each action button inside the row has a Mantine `<Tooltip>`.
   Hovering an action button at the right edge of a row fires both
   — the OS-rendered native tooltip and the Mantine portal tooltip
   stack on top of each other.
2. **The connect path shows two spinners.** During the initialize
   handshake the `<Button loading>` Connect button spins, and the
   Activity icon (DEC-020) also spins because the in-flight count
   includes the handshake JSON-RPC call. Two spinners for one
   user-visible operation = noise.

The native-tooltip + Mantine-tooltip pattern is a project-wide hazard
— every surface that uses Mantine `<Tooltip>` AND wraps a `<div>` with
a native `title` will produce the same double-tooltip. So the fix is
not just the log row; it's a project-wide audit.

The two-spinner symptom has a cleaner fix than "just hide one
spinner": **make the Connect button tristate** so the button text
itself communicates the state. While connecting the button reads
`Abort` and clicking it cancels the in-flight handshake — solving
two problems at once: the visual noise (no spinner) and a missing
affordance (no way to give up on a slow connect today other than
clicking elsewhere or refresh).

## What ships

### A. No double tooltips, anywhere

Audit and fix:

- `src/ui/log-panel.tsx:510` — the headline `<div>` has
  `title={headlineTitle}` (a string with full method, byte size,
  duration, notification note). Remove the native `title`. The chip
  values it was meant to surface are now reachable via the row
  expander (DEC-013), and the chip-fold breakpoints (DEC-014) already
  guarantee at least one chip stays visible at every width.
- `git grep -nE "title=\\{|title=\"" src/ui` — every other ad-hoc
  native `title=` inside a Mantine-tooltipped subtree gets removed
  or moved to the appropriate Mantine `<Tooltip>` so there is exactly
  one tooltip per element.
- Document the rule in `.agents/skills/project-maintainer/feedback-folding.md` so a
  future Worker doesn't reintroduce the pattern.

### B. Tristate Connect / Abort / Disconnect button

State machine in `connection-bar.tsx`:

| `status.state` | Active server set | Button label | Action            | Color   |
| -------------- | ----------------- | ------------ | ----------------- | ------- |
| `idle`         | no                | `Connect`    | (disabled)        | default |
| `idle`         | yes               | `Connect`    | `connect(active)` | filled  |
| `connecting`   | yes               | `Abort`      | `disconnect()`    | red     |
| `connected`    | yes               | `Disconnect` | `disconnect()`    | default |
| `error`        | yes               | `Reconnect`  | `connect(active)` | filled  |

The button is **always present** (never replaced by a spinner). Its
text + color communicates the state. The `loading` prop is dropped.
The Activity icon spinner (DEC-020) keeps spinning during the
handshake — that's its job — but it's no longer the second of two
spinners; it's the only one, and it's about request-level activity
not connection lifecycle.

Tooltip per state — single tooltip, no native title:

- idle, no active: `Pick a server first`
- idle, active: `Connect to <name>`
- connecting: `Cancel the in-flight connection (handshake will be aborted)`
- connected: `Disconnect from <name>`
- error: `Try connecting to <name> again`

The existing `disconnect()` function in `src/state/connection.tsx`
already aborts in-flight requests via the v1.1.20 epoch bump
(`connectEpochRef.current += 1` + `client.disconnect()`), so Abort =
`disconnect()` works without new plumbing.

## Options considered for the spinner-noise fix

- **A. Drop one of the spinners.** Pure subtraction. Rejected — the
  Activity icon's spin is independent of connection lifecycle (any
  inflight request spins it), and the Connect button's `loading`
  prop is a real signal. Removing either is wrong.
- **B. Tristate Connect / Abort / Disconnect** — chosen. Solves the
  spinner duplication AND adds a missing feature (give-up affordance
  during a slow connect). Symmetric: every state has a single
  button with clear text.
- C. Connect button shows the spinner for connection, Activity icon
  shows it for tool calls. Rejected — same reasoning as (A); these
  semantically overlap during the handshake.
- D. Replace Activity icon with progress bar. Rejected — out of
  scope; DEC-020 is its own decision.

## Falsifier

The DEC has shipped successfully if, on the live deploy:

1. **No double tooltips on log rows.** Hover the timestamp / method
   title / each action icon (`↔`, `⎘`, `⤓`). Each shows exactly ONE
   tooltip — Mantine's, never a native browser one.
2. **Project-wide audit clean.** `git grep -nE "title=\\{[^}]*\\}|title=\"[^\"]*\"" src/ui src/state` returns only Mantine `<Tooltip label=` cases (no native HTML `title=` on elements that also have a Mantine Tooltip in their subtree).
3. **Connecting state shows the Abort button.** Click Connect on a
   slow server — the button text is `Abort` (not a spinner), red
   color, clickable. Click it — the handshake aborts and the status
   flips to `idle`, no toast pretending success.
4. **Only the Activity icon spins during connect.** Open DevTools →
   inspect the chrome region during connect. Exactly one spinning
   `<Loader>` is visible (the Activity icon). The connect button is
   text, no spinner.
5. **Critic-gated under DEC-002.**

## Anti-cases

- The Activity icon must NOT change behaviour. It still spins when
  the in-flight count > 0, regardless of connection state.
- Click on the `Abort` button must NOT show a "Disconnected" toast —
  the user didn't disconnect, they cancelled. A neutral
  `Connect cancelled` system-log entry is enough; toast is overkill.
- Aborting MUST not leave the active server in `error` state. After
  abort, the state should be `idle`, ready to retry.
- Native `title=` on form `<input>` elements (e.g., the URL field in
  the Add modal) is OK — those are not Mantine-tooltipped. Audit is
  scoped to subtrees that ALSO render a Mantine `<Tooltip>`.

## Advisor sign-off

UX critic mandatory under DEC-002 (visible-surface change to the
header chrome). Particular attention to: button color in `connecting`
state, the abort UX (does cancelling feel right?), and that no log
row shows a stacked tooltip after the audit.

## Status

Closed — shipped as v1.2.4 (Worker commit `46261b0`, release
`61c17c6`). Critic verdict `pass` after one re-spawn (the first critic
instance crashed at 521s with API error 400 "Could not process image";
the re-spawn with a no-screenshots brief succeeded).

All 9 falsifiers + 5 regression checks PASS, including F5 (the
load-bearing Costa-flagged anti-case): `toastCount=0` at 200ms and
1700ms after Abort click, system log ends with `Connect cancelled`,
no spurious `Disconnected.` trailing entry. F7 SKIPPED-NO-PATH per
spec allowance (no available server reaches `error` state with a
clean retry path in the test catalog).

This was the first ship of direct Costa-feedback through the framework
two-step after the four-DEC design-knowledge wave (DEC-025/026/027/028)
(historical: see git log around 2026-04-26).
