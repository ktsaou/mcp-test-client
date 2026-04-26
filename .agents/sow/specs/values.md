# Values — the user value this project produces

**Updated**: 2026-04-25.

This is the daily anchor. Read it first.

## One-sentence promise

> A zero-install browser tool that lets a developer connect to a public MCP
> server, see what it offers, exercise its tools, and share a reproducible
> tool call — without installing anything, without a backend, without
> handing credentials to a third party.

## The user we optimise for

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

---

If a change does not make this more true for that user, it does not belong in
this product.
