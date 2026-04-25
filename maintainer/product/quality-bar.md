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
- **Per-message actions in the log.** Copy this message as JSON. Save to
  file. Jump to its paired request/response. Filter by direction.
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
