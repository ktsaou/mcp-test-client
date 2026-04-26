# DEC-027 — Keyboard navigation expansion (2026-04-26)

**Problem.** v1.1.x has _some_ keyboard support: `↑/↓` walks the log
prev/next-request cursor (v1.1.20 made the cursor visible), Enter
submits the add-server form, Esc closes Mantine modals. That is the
floor, not the ceiling. A developer doing real testing wants to stay
on the keyboard the way they stay in vim or VS Code.

The CRM-design synthesis (§6.8, §9 Stage 3, §13 Quick Interaction
Reference) gives a clear shortcut canon for power-user admin tools:

```
/                  Focus search
j / k              Down / up in lists
Enter              Open selected
Escape             Close drawer/modal/palette
c                  Create new
e                  Edit selected
?                  Show shortcut help
s                  Toggle sidebar
f                  Focus filter bar
```

We do not need every one of these — mcp-test-client is a single-user
tool and there's no "create" flow outside the Add modal — but we do
need the ones that match the surfaces we have.

## What ships

A first-class `useGlobalShortcut(key, handler, opts)` hook that
respects Mantine's `useHotkeys` semantics (skip when typing in
inputs, modifier rules per WCAG 2.1.4) and registers shortcuts in a
discoverable catalog.

| Key      | Effect                                                     | Scope                       |
| -------- | ---------------------------------------------------------- | --------------------------- |
| `Cmd+K`  | Open command palette (DEC-025)                             | Global                      |
| `/`      | Focus the log filter input                                 | Log panel focused / global  |
| `j`      | Move log cursor down 1 request (alias of `↓` from v1.1.20) | Log panel focused           |
| `k`      | Move log cursor up 1 request (alias of `↑`)                | Log panel focused           |
| `Enter`  | Expand the currently-cursored log row                      | Log panel focused           |
| `Esc`    | Close the topmost overlay (modal / palette / drawer)       | Global                      |
| `c`      | Open the Add-server modal                                  | Global                      |
| `e`      | Edit the active server (open Edit modal)                   | Global, when active != null |
| `?`      | Open the Shortcut help modal                               | Global                      |
| `s`      | Toggle sidebar collapsed/expanded                          | Global                      |
| `Cmd+\`` | Toggle theme (dark / light / system cycle)                 | Global                      |

A **Shortcut help modal** lists every shortcut grouped by scope, with
the same key labels that appear in tooltips. Press `?` from anywhere
to open it; Esc closes. The modal is generated from the shortcut
catalog (single source of truth), so a new shortcut auto-appears in
help.

Tooltips on every actionable button gain a small kbd hint when the
matching shortcut exists ("Add server (c)", "Edit server (e)").

## Options considered

- **A. Mantine `useHotkeys` + a thin shortcut-catalog wrapper.**
  Chosen. We already depend on `@mantine/hooks`. The catalog wrapper
  centralises (key, handler, scope, label) so help and tooltips both
  derive from it.
- B. `react-hotkeys-hook`. Rejected — duplicate functionality with
  what's in `@mantine/hooks`, no clear win, +1 dependency.
- C. Build everything on raw `keydown` listeners. Rejected — Mantine
  already handles modifier matching, input-skipping, and focus-scope
  edge cases; no reason to reinvent.

## Anti-cases

- Single-letter shortcuts (`c`, `e`, `s`, `j`, `k`) MUST be
  suppressed when the user is typing in an `<input>`, `<textarea>`,
  contenteditable, or the JSON-RPC raw editor. Mantine's `useHotkeys`
  does this by default; the wrapper must not weaken it.
- Shortcuts MUST not conflict with browser-reserved combinations
  (`Cmd+T`, `Cmd+W`, `Cmd+R`). The chosen set avoids these.
- WCAG 2.1.4 forbids single-letter shortcuts that aren't either: in a
  toggle-able UI mechanism, OR remappable, OR active only on focus.
  Our `j/k/c/e/s/?/`/Esc all satisfy "only active when no input has
  focus". Document this in the help modal.
- The cursor for `j/k` is the same one that v1.1.20 added the
  `data-current` highlight to — no duplicate state.

## Falsifier

The DEC has shipped successfully if, on the live deploy:

1. Pressing `?` from anywhere (no focus anywhere, sidebar focused,
   log focused, request panel focused) opens the shortcut help modal
   and lists every entry from the catalog.
2. Pressing `c` opens the Add modal. Pressing `c` while the URL
   field of the Add modal is focused does **nothing** (the letter "c"
   is typed into the field).
3. Pressing `j` moves the v1.1.20 log cursor exactly the same as
   pressing `↓` did — `data-current` advances to the next request row.
4. Tooltip on the Add-server button reads "Add server" with a `c`
   kbd-style suffix.
5. The catalog has exactly one definition per shortcut — no shortcut
   reaches `keydown` from two registrations.
6. The shortcut help modal is keyboard-navigable (Tab through
   sections, Esc closes).
7. Critic-gated under DEC-002.

## Advisor sign-off

UX critic (visible-surface change: tooltip kbd hints + help modal).
Accessibility advisor recommended — single-letter shortcuts are a
WCAG sensitive area; want a fresh check that the input-skipping
suppression is bulletproof.

## Status

Closed — shipped as v1.2.2 (Worker commit `78edf8d`, release
`1f8ec08`). Critic verdict `pass` (no followups required). All seven
falsifiers + four regression checks PASS, including F3 (the WCAG
2.1.4 security floor — single-letter shortcuts correctly suppressed
inside `<input>` / `<textarea>`).

`/` ships as an alias of `Cmd+K` (opens command palette) since no
log search input exists yet — DEC text "focus the log filter input"
is forward-looking (historical: see git log around 2026-04-26).
A future log-search UI can repoint `/` without re-opening this DEC.
