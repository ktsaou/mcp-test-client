# Security & Threat Model

Because this app is browser-only with no backend, our threat model is small
but specific. This spec enumerates what each actor can try and how we
respond.

---

## 1. Principles

- **No secrets leave the user's browser** except to the MCP server they
  explicitly connected to.
- **No third-party runtime dependencies.** The static build includes our
  source only. No analytics, no CDN fonts, no tracking pixels, no A/B
  tools, no Sentry.
- **Strict Content-Security-Policy** emitted via `<meta http-equiv>` in the
  built `index.html`. See §4.
- **Origin is us, our server is theirs.** We talk JSON-RPC to a server the
  user chose. We assume that server is untrusted until proven otherwise by
  the user.

## 2. Actors and threats

### 2.1 A malicious MCP server

What it can try:

- **Oversized responses** → we cap message display at 1 MB and truncate with a
  "show more" toggle; buffers are bounded.
- **Infinite streams** → SSE / WebSocket streams have a per-request watchdog:
  if nothing arrives for N seconds (configurable, default 60s), we surface a
  "stream idle" notification; user can disconnect.
- **Invalid JSON-RPC** → SDK rejects; we surface the raw bytes in the log
  so the user can see what was sent.
- **Hostile `tools/list`** with misleading tool names, descriptions, or
  schemas → we display them exactly as the server sends; we do **not**
  execute descriptions as HTML (see §3 about XSS).
- **CSRF-like via GET SSE stream** → irrelevant: we initiate all traffic and
  use explicit POST.
- **Exhausting localStorage** → response payloads are _not_ persisted to
  localStorage. In-memory log only (capped).

### 2.2 A malicious user (of our app)

The app is single-player; there is no other user. But shareable URLs cross
users:

- **Hostile shareable URL** (§ `shareable-urls.md`) → fragment is JSON, parsed
  into typed fields only; never interpolated as HTML; never sent to a server
  other than what the recipient explicitly confirms.
- **Auto-connect abuse** → `connect: true` in a shareable URL still requires
  the recipient to see the server URL in the connection bar before any
  network call is made. (We gate the auto-connect behind a one-frame layout
  so the user can see and cancel.)

### 2.3 A malicious origin iframing us

We emit `X-Frame-Options: DENY` via `<meta>` and a
`frame-ancestors 'none'` CSP. Embedding is not supported.

### 2.4 The hosting provider (GitHub Pages)

Costa owns the repo and deploy pipeline. Compromise of the GitHub account
would let an attacker publish a malicious build. Mitigations:

- 2FA enforced on the publishing account (outside this repo's control).
- Every published commit is in git history.
- `package-lock.json` is committed; supply chain attacks via unpinned deps
  are bounded.
- CI runs `npm audit --audit-level=high` on every PR; failing audits block
  merges.

## 3. XSS hardening

We never interpolate server-provided data as HTML. React's default escaping
applies to every string we render. The raw-HTML injection APIs React
provides are banned by ESLint rule `react/no-danger` across the codebase, so
every rendering path goes through the safe text interpolation. Our JSON
pretty-printer renders into React text nodes and explicit span classes, never
via `innerHTML` or equivalent.

Syntax-highlighted responses are built from React elements, not strings.

## 4. Content-Security-Policy

Emitted via `<meta http-equiv="Content-Security-Policy" content="...">` in
`src/index.html` and baked into the production build:

```
default-src 'self';
connect-src *;
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'none';
```

Notes:

- `connect-src *` is required: the whole point is that users connect to any
  MCP server they choose. We cannot restrict this without breaking the app.
  We balance it with the other directives locking down every other vector.
- `style-src 'unsafe-inline'` is needed by React + our CSS variables; content
  from servers is never inserted as `<style>`.
- No `'unsafe-eval'`, no remote script loads.

## 5. Dependency policy

- Every dependency is pinned in `package-lock.json`. No `^` in production
  code (dev tooling is looser).
- Review dependency updates quarterly or when an advisory fires.
- Prefer standard-library and native browser APIs over adding a dep.

## 6. Supply-chain

- Dependabot enabled via `.github/dependabot.yml` — weekly, grouped by
  minor/patch.
- GitHub Actions workflows pinned to SHAs, not mutable tags.
- `npm publish` is **not** used; there is no npm package, only a static site.

## 7. Responsible disclosure

See `SECURITY.md` at the repo root.
