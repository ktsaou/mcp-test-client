# Product — what mcp-test-client is

**Updated**: 2026-04-25.
**Status**: v1.0 shipped, deeply rough, recovering toward v1.1.

This is the brief I read myself into at the start of every session. When scope
shifts or the quality bar moves, this is the first file that changes.

---

## 1. One-sentence promise

> A zero-install browser tool that lets a developer connect to a public MCP
> server, see what it offers, exercise its tools, and share a reproducible
> tool call — without installing anything, without a backend, without
> handing credentials to a third party.

If a change doesn't make that sentence more true for the target user, it
doesn't belong in this product.

## 2. The user

There are several plausible visitors. The one we optimise for:

> A developer who has _just_ heard of an interesting public MCP server. They
> have its URL in their clipboard. They want to see what it does in 60 seconds
> without `npm install`-ing anything, then either share it with a teammate or
> integrate against it.

Secondary users we accommodate but don't lead with:

- A server author who wants a quick sanity check from a clean origin
  (CORS, auth, schema rendering). MCP Inspector is their primary tool; we are
  the secondary one.
- An LLM ops person who wants to inspect a tool's response shape before
  wiring it into a prompt.

We are **not** building for: server authors debugging stdio servers (use MCP
Inspector); enterprise users who need persistent, multi-tenant tool histories
(out of scope); LLM-on-the-side users who want completions in our UI.

## 3. The 60-second flow we live or die by

Every visit starts here. If any step takes more than a few seconds of
confusion, we have lost.

1. Open the page. The UI looks like a tool, not a homework project.
2. Paste a URL. Hit Connect. See a clear "Connected" status.
3. See the tools/prompts/resources the server exposes, with **readable,
   non-truncated descriptions**.
4. Click a tool. Get a form with the tool's parameters, **labelled and
   described**, plus a Send button.
5. Send. See the response in a readable JSON view that respects newlines
   inside strings (multi-line text in `text` fields is the common case).
6. Copy the JSON of either side, or copy a shareable link, with one click.

If any of those six steps is broken or ugly, that is what we fix next.

## 4. Quality bar

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

## 5. Anti-goals (don't drift)

- No backend. No login. No server-side anything.
- No telemetry. No analytics. No third-party fonts.
- No stdio transport — browsers can't, and we don't pretend.
- No becoming MCP Inspector. We are the _other_ tool.
- No custom-rolled UI primitives when a battle-tested library does it
  better. (This was the v1.0 mistake.)

## 6. Differentiators (what we beat MCP Inspector at)

- **Zero install, hosted-friendly.** They can't be hosted publicly because
  of the stdio proxy. We are exactly that.
- **Better schema rendering.** They are stuck on Ajv 6 / draft-07 with
  known gaps in `$ref` / `oneOf` / `additionalProperties`. We use Ajv 8 /
  2020-12 and render those constructs properly.
- **Shareable URLs.** A link encodes the request so a teammate can
  reproduce the call. They have an open issue for this; we ship it.
- **WebSocket support.** We have it as a custom transport (with caveats);
  they don't.
- **No CVE-class spawn-and-proxy attack surface** (because no proxy).

## 7. Live status

Last shipped: v1.0.0 on 2026-04-23. **Status: rough.** User feedback (see
[`feedback.md`](feedback.md)) lists seven concrete failures of the §4 quality
bar. v1.1 is the current target — see open issues #14+ once they're filed.
