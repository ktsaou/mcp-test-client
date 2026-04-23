# Persistence

All state lives in the user's browser. No cookies, no server, no sync.

**Storage backends**

| Backend         | Used for                                                  |
|-----------------|-----------------------------------------------------------|
| `localStorage`  | Everything durable: server list, theme, tool params, etc. |
| `sessionStorage`| Nothing in v1.0. Reserved for OAuth state in v1.1.        |
| URL hash        | Shareable state (see `shareable-urls.md`).                |
| In-memory only  | Active connection, log buffer, transient UI state.        |

---

## 1. Namespacing

Every key lives under the prefix `mcptc:` (mcp-test-client). Using a prefix:

- Avoids collision with other apps on the same origin.
- Makes "reset all" a simple `Object.keys(localStorage).filter(k => k.startsWith('mcptc:')).forEach(...)`.
- Is easy to spot in DevTools.

**Reserved top-level keys**

| Key                     | Purpose                                              |
|-------------------------|------------------------------------------------------|
| `mcptc:version`         | Schema version integer. Currently `1`.               |
| `mcptc:servers`         | Array of server entries (see §3).                    |
| `mcptc:servers.active`  | ID of the currently selected server, or `null`.      |
| `mcptc:theme`           | `"system" | "dark" | "light"`. Default `"dark"`.     |
| `mcptc:history`         | Last N request/response records (cap 100).           |
| `mcptc:tools.<server-id>.<tool-name>` | Last-used form params for that tool.   |
| `mcptc:canned.<server-id>.<tool-name>` | Named saved requests for that tool.   |
| `mcptc:ui.<feature>`    | Per-feature UI prefs (panel widths, etc.)            |

## 2. Schema versioning + migrations

`mcptc:version` is read on app startup. If it's missing, we're on a fresh
install → write `1`. If it's less than the current version, we run migrations
sequentially from `src/persistence/migrations.ts`. If it's greater, we warn
and refuse to touch storage (user might be downgrading; don't corrupt their
data).

Migration signature:

```ts
type Migration = (storage: Storage) => void;
const migrations: Record<number, Migration> = {
  // from v1 -> v2
  2: (storage) => { /* transform keys in place */ },
};
```

## 3. Server entry

```ts
interface ServerEntry {
  id: string;             // nanoid
  url: string;            // full URL including scheme
  name: string;           // user-provided label
  transport: 'streamable-http' | 'sse-legacy' | 'websocket' | 'auto';
  auth?: {
    kind: 'bearer';
    token: string;        // stored in localStorage — see §5 for the security note
  } | {
    kind: 'header';
    name: string;
    value: string;
  };
  tags?: string[];        // 'public', 'local', user-defined
  addedAt: number;        // ms since epoch
  lastUsed: number | null;
}
```

## 4. History cap + rollover

Kept to 100 entries in a circular buffer. When full, oldest is dropped. Each
entry stores the request, response (or error), timestamps, and response size.
Full request/response JSON is stored but truncated at 64 KB per field to
protect quota.

## 5. Security note on token storage

Bearer tokens in `localStorage` are readable by any script running on our
origin. That is acceptable only because:

- Our origin loads no third-party scripts at runtime (no analytics, no CDN
  fonts — see `specs/security.md`).
- Users are warned in the "add server" dialog that this tool is for
  experimentation; don't paste long-lived production tokens.

A future v1.1 OAuth flow will use `sessionStorage` for access tokens (cleared
on tab close) and DCR client info in `localStorage`, matching MCP Inspector's
split.

## 6. Quota handling

Browsers usually allow 5–10 MB per origin for `localStorage`. We monitor with
a periodic check:

- At > 80 % estimated quota, show a warning banner suggesting the user clear
  history or old tool params.
- On quota-exceeded write, degrade: skip the write, log a warning, show a
  one-shot toast.

## 7. Reset

Settings → "Clear all stored data" → confirm → wipes every `mcptc:*` key and
reloads.

## 8. Export / import

Export = download a JSON file of all `mcptc:*` keys. Import = upload same.
Useful for moving setups across browsers. Tokens are included; users are
warned.

## 9. What is explicitly NOT stored

- Tool call **results**. We keep responses only in the in-memory log.
  Rationale: result payloads can be large and sensitive (think resource
  contents) and there is no good reason to persist them.
- Anything identifying the user.
- Anything about the machine (user-agent, IP, etc.).
