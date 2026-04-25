# DEC-009 — Per-response metrics: bytes, duration, estimated tokens (2026-04-25)

**Problem.** Costa relayed user feedback: a browser-only MCP test client is
how a developer _evaluates_ a server. Without seeing how big / fast /
LLM-costly the responses are, the user cannot decide whether the server is
usable in their integration. Today the deploy shows none of these.

**The three metrics, distinct and all needed:**

- **Bytes** — answers transport cost ("can I afford to round-trip this?").
  Computed as the byte length of the response payload as the user sees it
  (pretty-printed JSON UTF-8). Note: this is _not_ the wire size after
  Content-Encoding; it's the size of what the renderer displays, because
  that is what the user is reasoning about.
- **Duration** — end-to-end latency from the client `send()` call to the
  matching `onmessage` callback. The `LoggingTransport` decorator already
  sees both events; capturing the delta is mechanical.
- **Estimated tokens** — what the response will cost in LLM context. This
  is necessarily approximate; different models tokenise differently. We
  pick _one_ tokenizer that is representative for "modern frontier
  models" and label it.

**Options considered.**

For surfacing:

- _Per-message in the log only._ Smallest scope but the request panel's
  "Last result" view is the user's primary lookout — they'd miss the
  metrics there.
- _Per-message in the log AND in the request panel result view._ Required.
- _Plus a session-roll-up in the connection bar (cumulative bytes / time /
  tokens for the whole session)._ Possibly useful for power users; defer
  to v1.2 unless feedback demands it.

For tokens:

- _Heuristic: chars / 4._ Cheap, no dep, accurate to ±25 %. Honest if
  labelled "approx".
- _`gpt-tokenizer` package, cl100k_base or o200k_base._ Real BPE; the
  package's tokenize/detokenize code itself is small. **Note (corrected
  during v1.1.1 implementation 2026-04-25):** the original wrote ~25 KB
  gzipped here; that estimate was wrong. The `o200k_base` BPE table
  alone is **~2.0 MB raw / ~1008 KB gz** — intrinsic to a 200 K-vocab
  tokenizer, not a packaging issue. Browser-friendly (no WASM), but
  loading it eagerly would blow the [DEC-005](DEC-005-bundle-budget.md)
  budget instantly. The implementation uses `import('gpt-tokenizer/encoding/o200k_base')`
  on first expand; initial bundle is unaffected, lazy chunk is paid
  only when the user expands their first response row.
- _`tiktoken` (WASM)._ Most accurate but ships ~600 KB WASM. Fails our
  bundle budget instantly. Reject.

For _which_ tokenizer:

- _`cl100k_base`_ — GPT-3.5 / GPT-4 / GPT-4o-mini / Claude (similar). The
  most common shipping tokenizer through 2024.
- _`o200k_base`_ — GPT-4o / GPT-5 family. Newer, larger vocab, ~10 % fewer
  tokens for English than cl100k.
- _Both, with a switcher._ User-confusing. Reject.

For where the duration starts:

- _At `transport.send()`._ Ignores any time spent inside our state
  layer / SDK queue. Closest to "wire time".
- _At the point the user clicks Send (in the UI)._ Closest to "user
  perceived latency". For tool calls in particular this is the more
  honest number.
- _Both, exposed as separate fields._ Over-detailed. Pick the user-clock.

**Decision (pending advisor pass).**

Direction is locked; the _exact_ tokenizer is the bit needing an advisor:

- Surface metrics **per-message in the log AND in the request panel's
  last-result view.** Session roll-up deferred to v1.2.
- Use **`gpt-tokenizer` with `o200k_base`**. Why o200k: matches the
  current frontier (GPT-4o, GPT-5, Claude 4.x — Anthropic uses a similar
  vocabulary in scale even if not byte-identical), gives the user the
  best-current-guess number, and the project's own release notes target
  modern integrations. Label clearly as `~tokens (o200k)`.
- Measure **duration from the user-clock** (the moment the request panel
  fires the call), not the transport-clock. Display in ms with 2-digit
  precision until 1 s, then s with 1-decimal.
- Bytes = `new TextEncoder().encode(JSON.stringify(response, null, 2))
.byteLength`. Show with `formatBytes` (B / KB / MB).

**Falsifier.** A user runs the §3 flow on the v1.1.1 deploy, calls a
tool that returns a multi-paragraph markdown blob, and cannot answer
"how many bytes / how long / roughly how many tokens" without opening
DevTools. Then the surfacing was wrong.

**Advisor sign-off.** Pending. Spawn the UX-critic + a tokenizer-choice
analyst before drafting the v1.1.1 worker brief. Specifically:

1. _UX critic_ — does the chip placement read clearly? Does the label
   `~tokens (o200k)` read as "approximate" rather than authoritative?
2. _Performance analyst_ — does running `o200k_base.encode()` over a
   500 KB markdown response on the main thread cause jank? If yes, move
   off-thread (Web Worker) or downgrade to the heuristic.

**Release scope.** **v1.1.1**, immediately after v1.1's UX-critic clears
and v1.1 is deployed. Not folded into v1.1; that release is recovery
from v1.0 and adding scope mid-flight is the exact pattern
[`../skills/release-readiness.md`](../skills/release-readiness.md) is
preventing.

**Status.** Open. Decision-direction locked; advisor sign-off pending;
implementation deferred to v1.1.1.
