# DEC-018 — Per-tool form-state persistence (2026-04-25)

**Problem.** Costa's item #6: the user fills a tool's form, switches
to another tool to compare, comes back — and finds the form empty.
The form-state lives in `useState` inside `RequestPanel` and is lost
on unmount. Significant friction for any flow that hops tools.

## Sub-item checklist

- [ ] **#6 — persist form state per tool, per server.** Storage key
      `mcptc:tool-state.<server-id>.<tool-name>` (already reserved
      in `specs/persistence.md`). Stores `{ formValue, rawText, mode,
lastResult }`.
- [ ] **#6 — restore on tool select.** When the request panel
      receives a new selection, hydrate from storage if a value
      exists; otherwise seed from the share-inbox if the recipient
      arrived via a share link; otherwise default-empty.
- [ ] **#6 — survive across servers.** Switching servers and coming
      back must restore the same per-tool state. The key includes
      the server-id, so this is automatic if storage is set up
      right.
- [ ] **#6 — incomplete forms persist.** No "save" button; saving
      is implicit on every form change (debounced 200 ms).
- [ ] **#6 — clear-on-success flag.** After a successful Send, the
      lastResult is stored alongside the form value (so the user
      sees the prior result on return). The form value itself is
      _not_ cleared automatically.

## Direction

Implement as a custom hook `useToolStatePersistence(serverId, toolName)`
backed by `appStore`. The hook owns:

```ts
const { formValue, setFormValue, rawText, setRawText, mode, setMode, lastResult, setLastResult } =
  useToolStatePersistence(active?.id, selection.name);
```

Internal: a debounced effect writes the snapshot to `appStore`. On
mount and on key change, reads the snapshot and hydrates state.

Quota: per-tool entries can be large (raw JSON-RPC envelopes). Cap
each per-tool snapshot at 64 KB; truncate the raw editor and warn if
it exceeds.

LRU eviction: keep at most 200 per-tool entries (across all servers
and tools). On overflow, evict the least-recently-touched.

## Risks

- **Cross-tab race:** if the user opens the same tool in two tabs,
  the second tab's writes can clobber the first tab's. Acceptable
  for v1.2 — single-tab usage is the dominant case. Tracked for
  later if users complain.
- **Storage overflow:** see LRU above.

## Falsifier

- User fills tool A, switches to tool B, comes back to A — A is
  empty.
- User connects to server X, fills tool A, switches to server Y and
  back — A is empty.
- Storage write fails (quota) and the form silently drops the data
  without warning.

**Advisor sign-off.** Pending.

**Status.** Open. Target release: v1.2.1 (alongside DEC-017).
