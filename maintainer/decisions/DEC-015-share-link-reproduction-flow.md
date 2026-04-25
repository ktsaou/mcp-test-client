# DEC-015 — Share-link reproduction: precondition modals + repro investigation (2026-04-25)

**Problem.** Costa reports that the Share button copies a URL but
pasting it in another browser does not reproduce the request. The
v1.1.1 dev critic verified the reload flow ran cleanly in a fresh
`browser.newContext()` (server + tool + method + arg values all
restored after manual Connect). The two observations disagree.
Independent of the bug, the UX of "what happens if a precondition is
missing" is wrong today: silent in-memory entries, no explanation, no
guidance.

The reproduction chain (Costa's framing, confirmed):

1. Server URL matches an entry the recipient already has, or the
   recipient adds it (with their own auth — never ours).
2. Connection succeeds.
3. The same tool is exposed by the server.
4. Then — and only then — the tool request can be replayed.

Each missing precondition should surface as a modal that explains
what's needed and how to proceed.

## Two parts to this DEC

### Part A — the bug: needs-repro

The dev critic's `browser.newContext()` test passed; Costa's daily-use
observation fails. Possible divergences:

- Existing localStorage on the recipient's browser carries a stale
  entry for the same URL with a different `id` — the loader's
  `servers.find((s) => s.url === state.url)` might race with a
  not-yet-rendered context.
- The loader's `useEffect([status, inventory, setSelection])`
  applies the inbox once `status === 'connected'` AND the inventory
  contains the saved tool. If the inventory list arrives in chunks
  or arrives after a delay, the effect closes over the first empty
  inventory and never re-runs. (`useConnection().status` and
  `inventory` come from the same context; need to verify both
  trigger an effect re-run.)
- The hash gets stripped before the loader runs in some browsers
  (history replacement timing).
- The user sees an error toast but didn't realise that's the answer.

**Cannot repro on my own without one sentence from Costa**: which
step broke — _no server appeared in the sidebar_, _server appeared
but Connect failed_, _connected but no tool selected_, _tool
selected but form didn't pre-fill_. **Status: blocked on repro.**

### Part B — the UX flow: precondition modals

Independent of the bug; even if the loader is technically working,
the recipient has no idea what just happened. Implement four explicit
states with a single share-link-resolver context that walks the chain:

#### B.1 Server missing

If `state.url` doesn't match any entry in `servers`, open a Mantine
`Modal` titled _"Add a server to open this link"_:

> This shareable link wants to use the MCP server at
> `https://hf.co/mcp`. You don't have it in your list yet.
>
> Adding it stores the URL only — you'll configure your own auth.
>
> [Add server and continue] [Cancel]

On Add: create a real persisted `ServerEntry` (not just in-memory),
set it active, and proceed to B.2.

#### B.2 Connection check

After the recipient clicks Connect (manual; security spec), watch
`useConnection().status`:

- `connecting`: subtle inline spinner near the connection bar; the
  share-link toast says _"Waiting for connection…"_.
- `error`: open a Mantine `Modal` titled _"Connection failed"_ that
  shows `status.error.message` and gives [Open server settings] [Cancel].
- `connected`: proceed to B.3.

#### B.3 Tool existence check

Once `inventory.tools` is populated and `status === 'connected'`:

- If `inventory.tools.find(t => t.name === state.tool)` is found:
  setSelection (current behaviour); seed the inbox; toast _"Loaded
  shared tool call: tools/call · &lt;name&gt;"_.
- If not found: open a Mantine `Modal` titled _"Tool not found on
  this server"_:

  > This link wants to call `&lt;name&gt;`, but the server `&lt;url&gt;`
  > doesn't expose that tool. The server may have evolved since the
  > link was made.
  >
  > [Open as raw JSON-RPC anyway] [Cancel]

  On _Open as raw_: drop `state.args` into the raw editor with a
  pre-built `tools/call` envelope; let the user adjust before sending.

#### B.4 (Optional) Schema-mismatch check

Tool exists; arg shape may have evolved. Two paths considered:

- **(a) Don't check.** Pre-fill what we can; the server returns a
  JSON-RPC error if validation fails on its side. Cheap; ships now.
- **(b) Validate `state.args` against the now-current `inputSchema`
  via Ajv 8** (already in deps). Surface a fourth modal _"Tool
  parameters changed"_ showing which args don't fit and offering
  [Open form with the parts that fit] [Open as raw JSON].

**Decision: (a)** for the v1.1.3 release. The server is the schema
authority; if real users report the resulting error is confusing,
escalate to (b).

## Sub-item checklist

- [ ] **Repro identified** — Costa names the step that breaks; the
      loader bug (if any) is patched.
- [ ] B.1 server-missing modal renders, Add persists a real
      `ServerEntry`, share-link state survives the modal close.
- [ ] B.2 connection error opens the modal carrying the actual error
      message.
- [ ] B.3 tool-not-found modal opens; "Open as raw" works.
- [ ] All four flows (server missing → server present, connect ok,
      connect error, tool missing, tool present) covered by tests
      against a mock connection context.
- [ ] No regression: tokens still never in the share fragment;
      no auto-connect.

## Falsifier

A recipient pastes a share link, lands on the app, and at no point in
the next 30 seconds gets a clear answer to "what just happened" — no
modal, no toast, no inline state — even if the loader silently
worked. Then the UX flow is wrong even if the code is right.

**Advisor sign-off.** Pending — UX critic re-pass after Part B lands.

**Status.** **Open.** Blocked on Costa's bug-narrowing answer for
Part A. Part B (modal flow) ships in v1.1.3 regardless. The two parts
fold together if the bug is in the loader; ship as one PR.
