# DEC-017 — Curated server catalogs (2026-04-25)

**Problem.** A new user lands on the app with no servers in their list
and has to know an MCP server URL to even start. Costa's items #8
(public no-auth servers, one click) and #9 (known servers requiring
auth, with credential prompt).

We already have `public/public-servers.json` scaffolded from v1.0
(spec: `specs/public-servers-catalog.md`). The catalog loader exists
in `src/catalog/loader.ts`. The catalog is empty.

## Sub-item checklist

- [ ] **#8 — populate `public/public-servers.json` with no-auth
      servers.** Initial seed: - Hugging Face MCP — `https://huggingface.co/mcp` (auth: none
      for anonymous read; bearer-optional for higher rate limits). - Context7 — `https://mcp.context7.com/mcp`. - Netdata registry — `https://registry.my-netdata.io/mcp`. - Each entry confirmed reachable + CORS-permissive at PR time. - JSON Schema validates (`public/public-servers.schema.json`).
- [ ] **#9 — known servers with auth.** Same catalog file, with
      `"auth"` field set to `"bearer"` / `"header"` / `"oauth"`. UI
      adds a "Try it" button on each catalog entry that opens the
      add-server modal pre-filled with the URL + auth method
      (matching DEC-016 #3 deep-link flow). Credential field is
      empty + red until the user fills it.
- [ ] **UI: render the catalog.** The sidebar grows a "Discover"
      section above "Servers" (or a tab above the list). Each entry
      shows: name, URL, description, auth requirement, "Try it"
      button. Clicking "Try it" on a no-auth entry adds + connects
      (or selects + connects if already saved). On an auth-required
      entry, opens the modal pre-filled, awaiting credentials.
- [ ] **Discoverability copy.** The empty-state in the sidebar
      ("No servers yet") gets a CTA: "Try a public MCP server" →
      jumps to the Discover section.

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
