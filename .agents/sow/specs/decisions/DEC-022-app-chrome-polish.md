# DEC-022 — App chrome polish: GitHub link + in-app docs viewer (2026-04-25)

**Problem.** Two trivial-looking but high-visibility issues from
Costa's items #1 and #2:

- **#1** — no link to the GitHub repo from the app. Users who want to
  star, file an issue, or contribute have to go hunt for it.
- **#2** — the only "documentation link" today is the
  `<Anchor href="specs/security.md" target="_blank">` in the
  add-server modal that opens the raw `.md` file from GH Pages. Costa
  calls it "extremely ugly". The whole `docs/` and `specs/` directory
  is much richer than that suggests; an in-app markdown + Mermaid
  viewer would surface it properly.

## Sub-item checklist

- [ ] **#1 — GitHub icon in header.** A small `<ActionIcon>` linking
      to `https://github.com/ktsaou/mcp-test-client`. `target="_blank"
rel="noopener noreferrer"`. Tooltip "View source on GitHub".
      Inline SVG (no new icon dep).
- [ ] **#2 — in-app docs viewer.** A `<ActionIcon>` opening a Mantine
      `Modal` size="xl" or a `Drawer` that hosts a `<DocsViewer>`
      sidebar with a list of available docs from `docs/` + `specs/`,
      and a main pane that renders the selected doc as Markdown.
      Markdown rendered with `react-markdown` + `remark-gfm`. Mermaid
      blocks rendered with `mermaid` (lazy-loaded — Mermaid is heavy,
      ~600 KB raw / ~150 KB gz; load on first render).
- [ ] **#2 — security-link rewrite.** The
      "[security notes](specs/security.md)" anchor in the add-server
      modal becomes "open security notes" → opens the in-app viewer
      pre-scrolled to that doc.
- [ ] **#2 — bundle hygiene.** Mermaid + react-markdown chunks lazy
      under `import('./docs-viewer/markdown')`. Initial bundle stays
      under DEC-005's 350 KB cap.

## Direction

**Confirmed (Costa Q10 + Q11, 2026-04-25):**

- **Q10 — full in-app viewer (option A).** Markdown + Mermaid,
  lazy-loaded. Costa specifically wants the docs to render as a real
  reader, not as raw `.md`. Mermaid is in scope so diagrams render
  inline; lazy-loaded to keep the initial bundle under DEC-005's
  350 KB gz cap.
- **Q10 forward-looking — "Test this MCP with an LLM chat".** Costa
  raised this as a v1.3+ scope expansion (a chat UI that wires an LLM
  to the connected MCP server's tools). If it lands, the docs
  renderer will need to grow to "full markdown + mermaid +
  paste2markdown + more". Captured separately in **DEC-023**;
  feasibility research is running in the background. The DEC-022
  viewer is built today with that future shape in mind: don't pick a
  markdown library that can't handle paste-to-markdown / image /
  copy-as-rich-text without ripping it out.
- **Q11 — doc seed (option A) + "link your MCP server to this
  client" doc.** Initial set ships exactly as drafted (quick-start,
  security, CORS, websocket, shareable URLs, public-servers
  catalog), plus a new doc:
  `docs/integrate-your-mcp-server.md` — explains the deep-link
  contract from DEC-016 (`?add=<url>&name=…&transport=…&auth=…`) so
  MCP server operators can add a "Try with mcp-test-client" link
  to their own docs/site. This is the bidirectional half of the
  catalog: not just "here are servers you can try", but "here's how
  to make your server discoverable from this client".

A dedicated `src/docs-viewer/` directory:

```
src/docs-viewer/
├── DocsViewer.tsx        — modal + sidebar + main pane
├── docs-index.ts         — static list of { id, title, source }
├── markdown.tsx          — react-markdown + mermaid renderer
└── docs-viewer.test.tsx
```

`docs-index.ts` is hand-curated: the small set of docs we actually
want to surface. Initial seed:

- Quick start (`docs/quick-start.md`)
- Security (`specs/security.md`)
- CORS for server operators (`docs/cors-explainer.md`)
- WebSocket transport (`specs/websocket-transport.md`)
- Shareable URLs (`specs/shareable-urls.md`)
- Public servers catalog (`specs/public-servers-catalog.md`)
- **Integrate your MCP server** (`docs/integrate-your-mcp-server.md`,
  new — to be authored as part of v1.2.2)

Each entry's `source` is a `?url` import or a fetched URL relative to
the deploy base. Vite handles `?raw` imports cleanly; we get the
markdown text at build time, no runtime fetch needed.

Mermaid: dynamic import on the first `<pre><code class="language-mermaid">`
encountered. The mermaid module renders to SVG. Errors render as a
fallback code block.

## Falsifier

- The GitHub icon doesn't show, or the link is wrong.
- The docs viewer crashes on a Mermaid block.
- A doc that exists in `docs/` is missing from the in-app index.
- The bundle exceeds 350 KB gz (DEC-005) — likely if Mermaid isn't
  lazy.

**Advisor sign-off.** Pending — UX critic for the viewer chrome (does
it feel like a real reader, or like a popup?), perf analyst for the
Mermaid-load behaviour (jank on first render?).

**Status.** Open. Target release: v1.2.2 (chrome polish bundle).
