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

This is a feature no other browser-based MCP tool offers as of April
2026 (verified by the catalog-research pass running in parallel).

## Open feasibility questions

The whole DEC depends on three "yes" answers, all of which the
research agent (started 2026-04-25) is currently confirming or
refuting. **No implementation work begins until research returns
"feasible".**

1. **Browser-direct CORS:** does at least one credible LLM provider
   allow `fetch` from arbitrary browser origins? OpenRouter is the
   leading candidate (Costa specifically mentioned `openrouter/free`).
   If every major provider blocks browser-direct calls, this DEC is
   dead in browser-only form — we'd need a backend, which is out of
   scope for the project.
2. **Tool-call bridge:** can the existing MCP SDK (already in the
   browser bundle) accept tool calls forwarded from a chat-completion
   stream and return results in the OpenAI-compatible function-call
   shape, all client-side? Reference implementations in
   anthropic-cookbook / Vercel AI SDK are the prior art to study.
3. **Bundle budget:** can we add a chat UI + LLM streaming + tool-
   bridge without blowing past DEC-005's 350 KB gz initial-load cap?
   Likely the chat surface itself goes lazy under
   `import('./chat')`, similar to the docs viewer.

## What ships first if research is positive

A minimal viable shape, aggressively scoped:

- One default provider (whichever the research confirms is
  CORS-permissive with a usable free tier — most likely OpenRouter).
- BYOK field for that provider, plus a "custom OpenAI-compatible
  endpoint" option for self-hosted (Ollama, llama.cpp server).
- API keys stored in `localStorage` under `mcptc:llm-keys`, with the
  same "treat this like a password" warning as DEC-021's export
  toggle.
- Streaming chat UI with a single conversation thread (no history,
  no branching — that's v1.4 if there's appetite).
- Tool-call bridge wired to the active MCP server's `Client`.
- Every LLM request and tool call logged in the existing log panel,
  so the developer sees the same trace shape they're used to.
- No agentic loops, no tool-call retries, no temperature tuning. This
  is a developer-facing test harness, not a chat product.

Markdown rendering grows to "full": the v1.2.2 stack
(`react-markdown` plus `remark-gfm` plus Mermaid) is extended with
paste-to-markdown for the chat input. Inline code blocks render with
a copy button matching the log panel's chip style.

## Sub-item checklist (gated on research)

- [ ] **Research outcome captured.** Either DEC-023 closes "not
      feasible" with the evidence, or it opens with a confirmed
      provider + CORS path + bundle estimate.
- [ ] If feasible: a Chat panel surface, lazy-imported, that does
      the basic loop above.
- [ ] If feasible: per-LLM-request log entries that thread into the
      existing log panel — the developer sees one continuous trace,
      not two parallel ones.
- [ ] If feasible: BYOK storage + warnings parallel to DEC-021's
      credentials handling.
- [ ] If feasible: a clear-eyes risks doc covering rate-limit UX,
      key-leak surface area, and what happens when the LLM goes off
      the rails.

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
purist + security reviewer once research returns.

**Status.** **Open, gated on feasibility research.** Target release:
v1.3.0 (or closed-not-feasible with evidence). Not in scope for v1.2.

**Linked:**

- [DEC-022](DEC-022-app-chrome-polish.md) — the docs viewer's
  markdown stack is the foundation this DEC builds on.
- [DEC-005](DEC-005-bundle-budget.md) — the 350 KB gz initial-load
  cap that gates the Chat surface as lazy.
