# DEC-017 — Curated server catalogs (2026-04-25)

**Problem.** A new user lands on the app with no servers in their list
and has to know an MCP server URL to even start. Costa's items #8
(public no-auth servers, one click) and #9 (known servers requiring
auth, with credential prompt).

We already have `public/public-servers.json` scaffolded from v1.0
(spec: `specs/public-servers-catalog.md`). The catalog loader exists
in `src/catalog/loader.ts`. The catalog is empty.

## Architecture change (Costa Q3 + Q4, 2026-04-25)

The earlier draft of this DEC put no-auth and auth-required catalogs
behind a "Discover" section in the sidebar. Costa rejected that
direction:

- **Q4 — no Discover surface.** No-auth catalog entries auto-merge
  into the user's server list at app boot (only entries the user
  doesn't already have, matched by URL). Auth-required catalog
  entries surface as a **selectable list inside the add-server
  modal** — the user picks "Hugging Face MCP", "GitHub MCP",
  "Sentry MCP", etc. from a dropdown, or chooses "Add a custom URL"
  to fall back to the manual flow.

- **Q3 — refresh the seed list.** My memory of public MCP servers is
  out of date; many more public no-auth MCP servers exist now.
  Research is running in the background (April 2026 catalog refresh)
  with the requirement that every entry is verified reachable +
  CORS-permissive before it lands in `public/public-servers.json`.

The Discover-tab idea is dropped. The catalog is **invisible
infrastructure** — it makes the empty-state populated and the
add-server modal known-server-aware, without requiring the user to
discover yet another UI region.

## Sub-item checklist

- [ ] **#8 — populate `public/public-servers.json` with no-auth
      servers.** Seed list verified by the April-2026 research agent
      (live MCP `initialize` handshake + CORS preflight per entry).
      Nine entries qualify; see the verified seed list below.
- [ ] **#8 — auto-merge into user's server list at boot.** On app
      mount, after persistent state is hydrated: for every catalog
      entry not already in `servers` (matched by URL), insert with
      `source: 'catalog'` so a future "remove from catalog" sweep can
      identify them. The user can rename, delete, or edit any
      auto-merged entry — no special protection.
- [ ] **#8 — never re-add a deleted catalog entry.** When the user
      deletes a catalog-sourced entry, persist a tombstone
      (`mcptc:catalog-tombstones`: array of URLs). Auto-merge skips
      tombstoned URLs. Otherwise the user's "delete" is meaningless.
- [ ] **#9 — known auth-required servers in the add-server modal.**
      The add-server modal grows a "Pick a known server" dropdown
      above the URL field. Selecting an entry fills URL + transport + auth method (and the auth-header-name if auth=header).
      Credential value remains empty + red until the user fills it.
      Selecting "Add a custom URL" reveals the manual fields with no
      pre-fill.
- [ ] **#9 — auth-required catalog entries.** Same JSON file,
      `auth: "bearer" | "header" | "oauth"`. Each entry carries a
      `signup_url` field pointing at where the user gets their token.
- [ ] **Empty-state CTA.** The empty-state in the sidebar
      ("No servers yet") still gets a CTA — but now it points at
      "Add server" (auth-aware, with the dropdown) instead of a
      Discover region. The auto-merge usually means the user sees
      a populated list at first paint and never hits this empty
      state, but it remains as a fallback.

## Direction

`public/public-servers.json` is a static JSON shipped under the GH
Pages root. The loader is already resilient (catalog missing →
empty array). Populate it with 3–5 representative entries, including
at least one of each auth shape (none / bearer / header).

The "Try it" button on a no-auth entry is shorthand for "use a
synthetic `?add=<url>&name=…` URL to walk through the DEC-016 flow
without the user typing the URL". The two DECs are independent but
play nicely together.

## Verified seed list (April 2026 research, live-tested)

The deep-research agent ran `initialize` handshakes + CORS preflight
checks on 25+ candidate URLs. Nine no-auth entries qualified; the
list below is the verified set. Every URL was reachable, returned a
valid MCP `initialize` response, and passed CORS from a browser
origin (mostly wildcard `*`; HuggingFace and Netdata echo the
origin, which is equally browser-valid).

All nine use **streamable-http** transport (the modern default; no
verified pure-SSE or websocket public servers as of 2026-04-25).

**No-auth list, ordered by developer-relevance** (top entries are
the most useful for a first-time user; the lower entries are
"interesting demos" that show the protocol's range):

```json
{
  "servers": [
    {
      "id": "context7",
      "name": "Context7",
      "url": "https://mcp.context7.com/mcp",
      "description": "Up-to-date library documentation and code examples by library name.",
      "transport": "streamable-http",
      "auth": "none"
    },
    {
      "id": "deepwiki",
      "name": "DeepWiki",
      "url": "https://mcp.deepwiki.com/mcp",
      "description": "AI-powered Q&A and wiki browsing for any public GitHub repository indexed on DeepWiki.",
      "transport": "streamable-http",
      "auth": "none"
    },
    {
      "id": "gitmcp",
      "name": "GitMCP",
      "url": "https://gitmcp.io/docs",
      "description": "Documentation search across any public GitHub repository; /docs lets the model pick the repo dynamically.",
      "transport": "streamable-http",
      "auth": "none"
    },
    {
      "id": "cloudflare-docs",
      "name": "Cloudflare Docs",
      "url": "https://docs.mcp.cloudflare.com/mcp",
      "description": "AI-powered search over the Cloudflare documentation site.",
      "transport": "streamable-http",
      "auth": "none"
    },
    {
      "id": "huggingface",
      "name": "Hugging Face Hub",
      "url": "https://hf.co/mcp",
      "description": "Search and browse models, datasets, and papers on Hugging Face Hub.",
      "transport": "streamable-http",
      "auth": "none",
      "auth_optional_bearer_for_rate_limits": true
    },
    {
      "id": "netdata-registry",
      "name": "Netdata Registry",
      "url": "https://registry.my-netdata.io/mcp",
      "description": "Live infrastructure data from a public Netdata parent — metrics, anomalies, alerts, processes.",
      "transport": "streamable-http",
      "auth": "none"
    },
    {
      "id": "manifold-markets",
      "name": "Manifold Markets",
      "url": "https://api.manifold.markets/v0/mcp",
      "description": "Browse prediction markets — search questions, get market details, look up users (play money).",
      "transport": "streamable-http",
      "auth": "none"
    },
    {
      "id": "subwayinfo-nyc",
      "name": "NYC Transit (MTA)",
      "url": "https://subwayinfo.nyc/mcp",
      "description": "Real-time NYC subway, bus, ferry, LIRR, Metro-North, and Citibike arrivals and alerts.",
      "transport": "streamable-http",
      "auth": "none"
    },
    {
      "id": "ferryhopper",
      "name": "Ferryhopper",
      "url": "https://mcp.ferryhopper.com/mcp",
      "description": "Search ferry routes and live availability across Greek and European ports.",
      "transport": "streamable-http",
      "auth": "none"
    }
  ]
}
```

**Auth-required list, for the add-server modal dropdown.** These
were verified to exist + accept browser CORS, but require user-
supplied credentials. Fewer entries than I expected — most "known
auth-required servers" worth seeding are still a small set. Padding
with weak entries (e.g. WebZum, where `initialize` works without
auth but every tool call returns "Authentication required") makes
the dropdown noisier without adding value, so they are deferred.

```json
[
  {
    "id": "cloudflare-mcp",
    "name": "Cloudflare API",
    "url": "https://mcp.cloudflare.com/mcp",
    "description": "Full Cloudflare API access — Workers, R2, KV, DNS, etc.",
    "transport": "streamable-http",
    "auth": "oauth",
    "signup_url": "https://dash.cloudflare.com/sign-up"
  }
]
```

Costa's call (Q-C3 in the next question round): include WebZum and
similar "init-yes / tool-no" servers, or hold the line at one
high-confidence OAuth entry and grow the list as more clean
candidates appear?

### Rejected at research time (do not add without re-verification)

- **Exa Web Search (`mcp.exa.ai/mcp`).** No `Access-Control-Allow-Origin`
  on actual responses. Browsers blocked. Works from curl. Worth filing
  upstream, but cannot ship in a browser-only client today.
- **Astro Docs (`mcp.docs.astro.build/mcp`).** Same — Netlify deploy
  drops CORS headers on the response path.
- **AWS Knowledge MCP (`knowledge-mcp.global.api.aws`).** No CORS;
  redirects to AWS sign-in.
- **TweetSave SSE (`mcp.tweetsave.org/sse`).** Uses legacy SSE with
  session-URL management — qualifying it would mean implementing the
  legacy SSE flow, complexity not justified for a Twitter-bookmark
  demo.

### Stability caveat

None of the nine entries comes with an SLA for public no-auth
access. The high-confidence operators (Context7, DeepWiki,
HuggingFace, Cloudflare, Netdata) are funded organisations and
likely stable. SubwayInfoNYC and Ferryhopper are indie/small-team
deployments and could disappear without notice.

Per DEC-017's auto-merge approach: when a catalog entry stops
working, the user just gets a connection failure on click; the
tombstone mechanism lets them remove it permanently. We add a
periodic CI verification job (DEC TBD) so the published catalog
gets re-checked weekly — entries that fail get flagged or removed
in a maintenance PR.

## Falsifier

- A user lands on the empty-state and has no obvious path to "try
  this without typing".
- A catalog entry's auth requirement is wrong and the user gets a
  cryptic error instead of a credential prompt.
- A no-auth catalog entry refuses to connect because the worker
  built it wrong.

**Advisor sign-off.** Pending. Spec purist should also verify the
catalog format still matches `specs/public-servers-catalog.md`.

**Status.** Open. Target release: v1.2.1.
