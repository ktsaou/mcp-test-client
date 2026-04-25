# DEC-003 — JSON view restores the legacy newline-respecting renderer (2026-04-25)

**Problem.** The v1.0 React port of `legacy/json-pretty-printer.js` dropped
the special handling that visualises `\n` inside strings as actual line
breaks. MCP responses regularly include multi-line text in `content[*].text`
fields (markdown, code, log lines). Without newline-respecting rendering,
they are unreadable. This is a §4 quality-bar item Costa called out
specifically.

**Options considered.**

- _Stay with the current minimal rendering._ Rejected — fails the bar.
- _Use Mantine's CodeHighlight for JSON._ Generic syntax highlight; doesn't
  detect nested JSON-in-strings; doesn't handle multi-line strings any
  better than what we have.
- _Port the legacy `json-pretty-printer.js` behaviour properly._ The
  original was good — Costa wrote it. The port should match it: nested-JSON
  detection, newline visualisation, copy-as-JSON outputs valid JSON.

**Decision.** Reimplement the JSON view to match the legacy behaviour:

- Detect JSON-in-strings and pretty-print recursively.
- For strings containing `\n`, render them across multiple lines, preserving
  indent context.
- Provide a "copy" affordance on every JSON node (or at least the root) that
  produces well-formed JSON, with newlines escaped per JSON rules.
- Keep React-element rendering (no `innerHTML` — see `specs/security.md` §3).

**Falsifier.** A user pastes a tool response with `content[0].text` =
markdown including code fences, and the rendered view shows a single
unreadable line.

**Advisor sign-off.** Pending — UX critic to confirm the rendering matches
or beats the legacy behaviour.

**Status.** Active.
