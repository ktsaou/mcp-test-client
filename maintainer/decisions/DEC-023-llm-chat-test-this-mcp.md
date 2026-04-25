# DEC-023 — "Test this MCP" with an LLM chat (2026-04-25)

**Problem.** The current test client lets a developer call an MCP
server's tools by hand — pick a tool, fill the form, send. That's the
right shape for protocol-level debugging, but it doesn't tell the
developer how their server behaves when an _LLM_ uses it. Tool
descriptions, parameter shapes, and error messages all matter
differently when the consumer is a model deciding when and how to
call.

Costa's framing (Q10, 2026-04-25):

> I am thinking if there is a way to have "Test this MCP" with an LLM
> chat (e.g. model `openrouter/free`) — but I don't know if LLMs allow
> this or CORS will block us — we could have an LLM selection where
> people can define their own, or provide API keys — if we do this, we
> need full blown markdown + mermaid + paste2markdown + more. But we
> need to research first if this is doable.

This is a v1.3+ scope, not a polish item. Pulling it into v1.2.2
would blow the bundle and the timeline.

## What this could look like

A new "Chat" mode in the app, alongside Form / Raw on the request
panel — or as a separate top-level surface in the AppShell.

User flow:

1. User connects to an MCP server (existing flow).
2. User opens the Chat panel.
3. User picks a model (free default; BYOK for paid models or
   self-hosted).
4. User types a prompt. The LLM receives the MCP server's tool list
   as function-call definitions; the chat loop forwards tool calls
   to the MCP server and returns results to the LLM until the LLM
   produces a final assistant message.
5. The Log panel records every wire message — both the LLM-side
   chat traffic and the MCP-side tool calls — so the developer sees
   the whole conversation as a JSON-RPC trace.

Why this matters for an MCP test client specifically:

- Tool descriptions get exercised in their actual context (a model
  reading them and deciding what to call).
- Parameter naming and types get pressure-tested (does the model
  fill them right, or does it hallucinate field names?).
- Error messages get pressure-tested (does the model recover when
  the server returns an error, or does it spiral?).
- Multi-turn flows get tested (resources + prompts + tools chained
  by an LLM, not by hand).

This is, as best I can tell, a feature no other browser-based MCP
test client offers in April 2026 — though I have not done an
exhaustive survey of competing tools, only of the public _server_
ecosystem.

## Feasibility — confirmed (research, 2026-04-25)

The deep-research agent ran live CORS preflight + POST tests against
nine major LLM providers at 2026-04-25 10:10–10:12 UTC. Every one
returned valid CORS headers permitting browser-direct calls. The MCP
tool-call bridge is implementable in-browser using the SDK we already
ship. Bundle cost is ~2–5 KB gz with raw `fetch()` + a hand-rolled
SSE parser. **DEC-023 is no longer gated.**

### Per-provider verdict

| Provider           | Browser-direct?                                           | Notes                                                                                                                                          |
| ------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **OpenRouter**     | ✅ Wildcard CORS                                          | Free tier (`:free` models, 200 req/day per model, no key required); OAuth PKCE for browser SPAs; BYOK 1M free requests/month.                  |
| **Anthropic**      | ✅ Wildcard CORS with one required header                 | Must send `anthropic-dangerous-direct-browser-access: true`. Officially documented; SDK has `dangerouslyAllowBrowser: true` to set it.         |
| **OpenAI**         | ⚠️ Wildcard on success, **omits CORS on error responses** | Browser blocks JS from reading 401 body — surfaces as `TypeError: Failed to fetch` instead of "invalid key". Needs intentional error handling. |
| **Groq**           | ✅ Wildcard CORS on every path                            | OpenAI-compatible format. SDK `dangerouslyAllowBrowser: true` is just an SDK warning suppressor; API itself is permissive.                     |
| **Mistral**        | ✅ Wildcard CORS                                          | Native API format.                                                                                                                             |
| **Google Gemini**  | ✅ With caveat                                            | Native endpoint works via `x-goog-api-key` header. OpenAI-compat endpoint (`/v1beta/openai`) rejects `x-stainless-*` headers from OpenAI SDK.  |
| **Together AI**    | ✅ Wildcard CORS                                          | OpenAI-compatible.                                                                                                                             |
| **Cohere**         | ✅ Wildcard CORS                                          | Cohere-specific format, not OpenAI-compatible.                                                                                                 |
| **DeepSeek**       | ✅ CORS allowed                                           | OpenAI-compatible. Chinese-origin service — data residency may matter.                                                                         |
| **Local (Ollama)** | ⚠️ Configurable; mixed-content limits it                  | Default allows localhost only; user sets `OLLAMA_ORIGINS=*` (or specific origin). HTTPS→HTTP from GH Pages blocked except `http://localhost`.  |
| **LM Studio**      | ⚠️ Configurable; Safari blocks entirely                   | "Enable CORS" toggle in server settings. Safari does not allow HTTP from HTTPS pages, period.                                                  |
| **llama.cpp**      | ⚠️ Configurable                                           | `--public-domain` flag enables CORS.                                                                                                           |

### MCP tool-call bridge — feasible

The `@modelcontextprotocol/sdk` 1.29 we already ship provides
`StreamableHTTPClientTransport` and `SSEClientTransport` that work in
browsers. The agentic loop is a ~50-line `while`:

1. `client.listTools()` → tools array.
2. POST to LLM with `tools` parameter and the user's message.
3. If response has `tool_calls`, invoke each via `client.callTool()`,
   push results as `tool` messages, re-POST.
4. Loop until LLM emits a final assistant message (or hits `MAX_TURNS`).

No new SDK needed. No backend needed. No WebSocket. STDIO transport
is browser-incompatible but irrelevant for us — we already use HTTP/SSE.

### Bundle estimate

| Component                         | Cost              |
| --------------------------------- | ----------------- |
| Raw `fetch()` + SSE stream parser | ~2 KB gz          |
| MCP SDK                           | already in bundle |
| Chat UI (Mantine, already loaded) | ~0 KB marginal    |
| **Total marginal**                | **~2–5 KB gz**    |

Compared to the `openai` npm SDK (~29 KB gz) or `groq-sdk` (~10.5 KB gz),
hand-rolled is dramatically lighter and avoids the SDK warning chrome
("dangerouslyAllowBrowser must be set"). DEC-005's 350 KB cap is not
threatened.

### Vercel AI SDK — rejected

The AI SDK's `DirectChatTransport` (6.x) invokes an _in-process agent_,
not a remote HTTP endpoint. For browser → OpenRouter the dev still has
to write a custom transport; the SDK's value evaporates. Plus its
streaming format is proprietary. Decision: skip. Use raw `fetch()`.

## Recommended shape (post-research)

Now that browser-direct is confirmed across the board, here is the
v1.3.0 minimum viable shape. Several sub-decisions remain Costa's
call (flagged below); the structure assumes his answers.

### Provider tier

- **Default: OpenRouter free tier.** No key required to start. The
  first chat works for a brand-new user with zero setup. Default
  free model TBD — research suggests
  `meta-llama/llama-3.3-70b-instruct:free` or
  `google/gemini-2.0-flash-exp:free`; needs a quick verification
  pass at PR time to pick whichever is currently most reliable.
- **OpenRouter BYOK via OAuth PKCE.** The user clicks "Sign in to
  OpenRouter" → redirected to `openrouter.ai/auth` → returns with a
  user-controlled API key the app stores. No raw key paste needed.
  This is the documented browser-SPA pattern OpenRouter built
  specifically for this case. PKCE callback URL must be on HTTPS
  (GH Pages is fine; localhost dev needs `http://localhost:3000`
  whitelisted).
- **Custom OpenAI-compatible endpoint.** Free-text base URL + API
  key. Covers self-hosted Ollama / LM Studio / llama.cpp + any
  paid provider (OpenAI, Groq, Mistral, Together, DeepSeek). For
  Anthropic specifically, the chat client auto-adds the
  `anthropic-dangerous-direct-browser-access: true` header when the
  base URL matches `api.anthropic.com`.

### Key storage

**Pending Costa's call (Q-A1, see below):** `sessionStorage` (cleared
when the tab closes; safer; matches the research recommendation) vs
`localStorage` (persists across sessions; matches the rest of the
app's auth-token handling — DEC-021 already handles bearer tokens
in `localStorage`).

The research strongly recommends `sessionStorage` for LLM keys
specifically, because users will paste keys for paid providers and
those keys have non-trivial cost-of-leak. Bearer tokens for MCP
servers (DEC-021) are usually narrow-scoped and per-server.

### Chat surface

- New top-level mode in the AppShell, alongside the existing tools /
  prompts / resources view: **"Chat"**.
- Single conversation thread per (server, model) pair. No history,
  no branching, no saved conversations — that's v1.4 if there's
  appetite.
- Streaming response display. Stop button cancels via `AbortController`,
  same pattern as DEC-016's connection cancel.
- Every LLM request, every tool-call, every tool-response: logged
  in the existing log panel as wire entries, so the developer sees
  the LLM trace and the MCP trace as one continuous flow. New
  log-entry kind: `llm` (alongside `wire` and `system`).

### Tool-call loop

- Pulls `client.listTools()` once on chat-mode entry; refreshes when
  the user clicks "Sync tools" (handles servers that reload).
- Passes tools as the OpenAI-compatible `tools` parameter.
- For each tool-call in the response: `client.callTool()`, append
  result as a `tool` message, re-POST.
- `MAX_TURNS = 10` hardcoded ceiling. UI shows "10/10 — stopped"
  if hit.
- No tool-call retries on error: errors return as tool-message
  content, the LLM decides what to do. This is intentional — the
  whole point of the feature is to expose how the LLM handles your
  server's error messages.

### Markdown stack growth

The v1.2.2 docs viewer ships `react-markdown` + `remark-gfm` +
Mermaid (lazy). The chat surface extends this with **paste-to-
markdown** for the chat input (so a user pasting an HTML table or
rich text gets reasonable Markdown out). Inline code blocks get the
same copy-button affordance the log panel uses.

## Open sub-decisions for Costa (post-research)

The research closed three feasibility gates but opened six smaller
design calls. Posed in the next question round, summarised here so
the DEC stays the source of truth:

- **Q-A1 — key storage:** `sessionStorage` (cleared when tab closes;
  research recommendation; safer for paid keys) vs `localStorage`
  (persists; matches DEC-021's bearer-token handling).
- **Q-A2 — OpenRouter BYOK acquisition:** OAuth PKCE flow now
  (cleanest, no raw-key paste) vs paste-key first / OAuth in v1.3.1
  (faster to ship).
- **Q-A3 — local providers:** explicit Chat-panel UX with config
  hints ("set OLLAMA_ORIGINS=…", "enable CORS in LM Studio
  settings") vs treat them as plain "custom OpenAI-compatible
  endpoint" with a one-line link to a docs page.
- **Q-A4 — OpenAI error UX:** OpenAI omits CORS on 401s, so JS sees
  a generic `TypeError: Failed to fetch`. Surface as "OpenAI may
  have rejected the key — re-check it" heuristic, or expose the
  raw network error?
- **Q-A5 — default free model:** which OpenRouter `:free` model is
  the v1.3.0 default — `meta-llama/llama-3.3-70b-instruct:free`,
  `google/gemini-2.0-flash-exp:free`, or pick at PR time based on
  current performance / rate-limits?
- **Q-A6 — chat thread scope:** one global thread (simpler) vs one
  per (server, model) pair (the natural "test this MCP" framing —
  switching servers gives you a fresh thread for that server).

## Sub-item checklist (research closed, design calls open)

- [x] **Research outcome captured.** Feasibility confirmed
      2026-04-25 by live CORS preflight + POST tests against nine
      providers. See "Feasibility — confirmed" section above.
- [ ] **Design calls Q-A1 through Q-A6 settled.** No worker brief
      until these are picked.
- [ ] Chat panel surface, lazy-imported, runs the agentic loop
      against the active MCP server.
- [ ] Per-LLM-request log entries (new `llm` kind) thread into the
      existing log panel — one continuous trace, not two parallel.
- [ ] BYOK storage with the chosen storage tier (Q-A1) + warnings
      parallel to DEC-021's credentials handling.
- [ ] OpenAI error-path heuristic per Q-A4.
- [ ] A clear-eyes risks doc covering rate-limit UX (free-tier
      exhaustion looking like an outage), key-leak surface, and
      LLM-going-off-rails.

## Falsifier

- The user opens the Chat panel, picks the default free model, types
  "list the tools and call one for me", and gets either silence or a
  stack trace. The chat loop has to be unfalseable on the happy
  path.
- The bundle exceeds 350 KB gz on initial load (DEC-005). If the
  combination of Mermaid, chat, tokenizer, and Mantine can't coexist
  under that cap, we raise the cap explicitly with a new DEC — not
  by accident.
- A user pastes their OpenRouter key and a future security audit
  finds it leaked into a server log, network request, or third-party
  script. Browser-side API keys are a real risk surface; this DEC
  must not treat them casually.

## Risks

- **Browser-direct LLM access is a moving target.** Providers change
  CORS posture without notice. A provider that works at v1.3.0
  release may not work three months later. The "custom endpoint"
  escape hatch exists exactly so users have a path forward when the
  default breaks.
- **Free tiers can be hostile.** Heavy rate-limiting on a free model
  makes the demo look broken to a first-time user. The default
  provider's free tier needs to be enough for the "type one prompt,
  get a response, see one tool call" demo flow at minimum.
- **API key UX is fraught.** Users will paste keys into a public
  client. Even with warnings, some will. The export-with-credentials
  toggle from DEC-021 needs to extend to LLM keys: either always
  strip them on export, or treat them with the same checkbox.
- **Scope creep.** Once a chat is in the app, requests for history,
  branching, prompt templates, multiple providers in one session,
  conversation export, etc. follow. Hold the line at v1.3.0 minimum
  shape; new asks become their own DECs.

**Advisor sign-off.** Pending. Will route through UX critic + spec
purist + security reviewer after Costa settles Q-A1 through Q-A6
and the worker brief is drafted.

**Status.** **Open, feasibility confirmed (2026-04-25).** Six design
calls (Q-A1 through Q-A6) are pending Costa's review before any
worker brief. Target release: v1.3.0. Not in scope for v1.2.

**Linked:**

- [DEC-022](DEC-022-app-chrome-polish.md) — the docs viewer's
  markdown stack is the foundation this DEC builds on.
- [DEC-005](DEC-005-bundle-budget.md) — the 350 KB gz initial-load
  cap that gates the Chat surface as lazy.
