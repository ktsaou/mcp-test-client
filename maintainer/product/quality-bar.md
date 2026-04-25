# Quality bar

This is the standard. "Done" means yes to all of these.

- **Visible feedback for every action.** Buttons have hover, active, disabled,
  and busy states. Selected tabs are obvious. Toggles toggle visibly.
- **Tooltips on every actionable element.** A user should never wonder what
  a button does.
- **Keyboard works.** Tab through the form. Enter sends. Escape closes
  modals. No clickable `<div>`s.
- **Layout is resizable where the user has different needs from us.** The
  inspector vs. request panel split, the log size, the sidebar — none of these
  are fixed.
- **JSON renders so a human can read it.** Multi-line strings keep their
  newlines. Long values can be expanded. Nested JSON is detected and
  pretty-printed inline.
- **The log is scannable.** Each entry has a bold method-summary
  headline (`tools/call · echo`, `prompts/get · greet`, etc.) so the
  user can read the request flow without expanding bodies. Per-entry
  collapse/expand exists; default-collapsed; global "Expand all" /
  "Collapse all" exist; **prev / next request navigation exists in
  the toolbar AND on `j` / `k` keys**. Timestamp + direction live
  inline in the headline (small) — not as a fixed-width left column
  pushing content right.
- **Per-message actions in the log.** Copy this message as the original
  raw JSON. Save to file. Jump to its paired request/response.
  **These actions are always visible**, not hover-only — a user who
  doesn't know the affordance is there must still see it. Filter by
  direction.
- **Action icons stay aligned under squeeze.** In any list-of-rows
  surface, the right-edge action icons share the **same X offset
  across every row** regardless of headline length, chip count, or
  panel width. Content (titles, metric chips) folds first when there
  isn't enough room — **buttons do not move and do not slide off
  the panel**. A user scanning a column of icons must actually find
  a column.
- **Tool descriptions are first-class.** They get prominent space in the
  request panel, not a 1-line truncation.
- **Saving and naming things uses real modals**, not `window.prompt()`.
- **Toasts confirm side effects** (saved, copied, deleted). No silent state
  changes.
- **Dark theme is the default and looks deliberate**, not blank-grey-on-black.
  Light theme is a real second-class citizen, not an afterthought.
- **The empty states are written.** "No server selected" is a paragraph that
  helps; not a void.
- **Per-response metrics are visible.** Every place a response is shown —
  the log entry, the request panel's last-result view — surfaces three
  numbers without DevTools: response size in bytes, end-to-end duration in
  milliseconds, and estimated token count if the response were fed into an
  LLM. These three answer the questions a real integrator brings: _transport
  cost, latency, LLM-context cost_.
