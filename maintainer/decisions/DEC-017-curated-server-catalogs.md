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
      servers.** Seed list pending the April-2026 research agent.
      Hard requirements per entry: stable HTTPS URL, no-auth or
      `auth_optional_bearer_for_rate_limits: true`, CORS-permissive
      verified at PR time, transport noted, one-sentence description.
      Bias toward fewer high-confidence entries over many unverified
      ones.
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

The seed list:

```json
{
  "servers": [
    {
      "id": "huggingface-mcp",
      "name": "Hugging Face MCP",
      "url": "https://huggingface.co/mcp",
      "description": "Search models, datasets, papers, spaces, and the Hub docs from any MCP-compatible client.",
      "transport": "streamable-http",
      "auth": "none",
      "auth_optional_bearer_for_rate_limits": true
    },
    {
      "id": "context7",
      "name": "Context7",
      "url": "https://mcp.context7.com/mcp",
      "description": "Library documentation and API references for popular open-source projects.",
      "transport": "streamable-http",
      "auth": "none"
    },
    {
      "id": "netdata-registry",
      "name": "Netdata registry",
      "url": "https://registry.my-netdata.io/mcp",
      "description": "Public Netdata observability registry — query Netdata's own metrics and topology.",
      "transport": "streamable-http",
      "auth": "none"
    }
  ]
}
```

Adjust if any of those URLs / auth-shapes turn out wrong on
first-connect verification.

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
