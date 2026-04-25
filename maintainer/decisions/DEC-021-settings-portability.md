# DEC-021 — Settings portability (export / import) (2026-04-25)

**Problem.** Costa's item #12. A user investing time configuring
servers, tokens, canned requests, layout sizes — all of it living in
`localStorage` — has no way to move the setup to another browser or
machine. They start over.

`specs/persistence.md` already mentions this as a future feature.

## Sub-item checklist

- [ ] **#12 — Export.** A "Download settings" button (in a settings
      menu opened from the AppShell header, or directly in the
      sidebar). Builds a JSON object `{ version: 1, exportedAt:
    ISO-string, data: { ...all mcptc:* keys, including credentials,
    flagged } }` and triggers a browser download.
- [ ] **#12 — Import.** A matching "Upload settings" affordance.
      Accepts a JSON file, validates `version === 1`, shows a confirm
      modal listing what will be replaced (servers, canned requests,
      layout, theme) and what will be kept (e.g. log history is
      session-only and unaffected). On confirm, replaces every
      `mcptc:*` key with the imported value.
- [ ] **#12 — Export warning.** The download button surfaces a
      Mantine `Alert` warning: _"This file contains your saved
      bearer tokens and custom-header values in plaintext. Treat it
      like a password file."_ Costa's words: settings include auth
      tokens; we don't redact them on export (otherwise the user
      can't actually move their setup); we warn and let them choose.
- [ ] **#12 — Schema-validate on import.** Reject malformed files
      with a clear error, not a silent no-op.
- [ ] **#12 — Versioning.** `version: 1` lets us evolve the format
      without breaking older exports; v2 onwards adds a migration
      path.

## Direction

Two new helpers in `src/persistence/portability.ts`:

```ts
export function exportSettings(): SettingsExport;
export function importSettings(
  blob: SettingsExport,
  options?: { onConflict: 'overwrite' | 'merge' | 'skip' },
): ImportResult;
```

The default conflict policy is **overwrite** (simplest, what the user
expects when they say "import"). A future option for merge is
defensible but adds UI complexity; defer.

UI lives in a new "Settings" affordance on the header (matches
chrome polish in DEC-022). Two buttons: Export, Import.

## Falsifier

- Round-trip: export from browser A, import into clean browser B,
  open the app — server list, canned requests, layout sizes match.
- Tokens make it across (verified by re-connecting on B without
  re-typing).
- Import file with malformed JSON shows a clear error and doesn't
  corrupt existing data.
- Import file with `version: 99` is rejected with a meaningful
  message ("export was made by a newer version of this app").

**Advisor sign-off.** Pending — security reviewer on the
plaintext-tokens-in-export warning copy + spec purist on the version
field.

**Status.** Open. Target release: v1.2.2.
