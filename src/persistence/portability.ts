/**
 * DEC-021 — settings export / import.
 *
 * Walk every `mcptc:*` key in localStorage, build a JSON blob the
 * user can download, and offer the inverse: parse such a blob and
 * write its keys back. Credentials handling is a user toggle — by
 * default the export includes auth tokens and bearer / header values
 * (with a warning); a checkbox strips them so the user can hand the
 * file to a colleague safely.
 *
 * Schema-versioned at `version: 1`. v2+ would carry a migration
 * path; v99 (or any unknown integer) is rejected with a clear error.
 */
import { STORAGE_PREFIX } from './schema.ts';
import type { ServerEntry } from './schema.ts';

export const PORTABILITY_VERSION = 1 as const;

export interface SettingsExport {
  version: typeof PORTABILITY_VERSION;
  exportedAt: string;
  /** `mcptc:*` keys with prefix included. Values are the raw stored JSON. */
  data: Record<string, unknown>;
  /**
   * True if credentials were stripped on export. Imports check this so
   * the import-confirm dialog can surface the "credentials needed"
   * notice per server.
   */
  credentialsStripped: boolean;
}

/** Build the export blob from current localStorage. */
export function exportSettings(opts: { includeCredentials: boolean }): SettingsExport {
  const data: Record<string, unknown> = {};
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      version: PORTABILITY_VERSION,
      exportedAt: new Date().toISOString(),
      data,
      credentialsStripped: !opts.includeCredentials,
    };
  }
  const ls = window.localStorage;
  for (let i = 0; i < ls.length; i++) {
    const key = ls.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    const raw = ls.getItem(key);
    if (raw === null) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    data[key] = parsed;
  }
  if (!opts.includeCredentials) {
    stripCredentials(data);
  }
  return {
    version: PORTABILITY_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    credentialsStripped: !opts.includeCredentials,
  };
}

function stripCredentials(data: Record<string, unknown>): void {
  // Server entries live under `mcptc:servers` as an array. Strip the
  // auth-value field from each.
  const serversRaw = data['mcptc:servers'];
  if (Array.isArray(serversRaw)) {
    const stripped = (serversRaw as ServerEntry[]).map((s) => {
      if (!s.auth) return s;
      if (s.auth.kind === 'bearer') {
        return { ...s, auth: { kind: 'bearer' as const, token: '' } };
      }
      if (s.auth.kind === 'header') {
        return { ...s, auth: { kind: 'header' as const, name: s.auth.name, value: '' } };
      }
      return s;
    });
    data['mcptc:servers'] = stripped;
  }
}

export interface ImportResult {
  ok: boolean;
  /** When ok=false, a reason the caller can show. */
  error?: string;
  /** When ok=true, count of keys that were written. */
  keysWritten?: number;
  credentialsStripped?: boolean;
}

export function importSettings(blob: unknown): ImportResult {
  if (typeof blob !== 'object' || blob === null) {
    return { ok: false, error: 'Settings file is not a valid JSON object.' };
  }
  const obj = blob as Record<string, unknown>;
  if (obj['version'] !== PORTABILITY_VERSION) {
    if (typeof obj['version'] === 'number' && obj['version'] > PORTABILITY_VERSION) {
      return {
        ok: false,
        error: `Settings file format is version ${String(obj['version'])} — newer than this app supports (v${PORTABILITY_VERSION}). Update the app or use an older export.`,
      };
    }
    return { ok: false, error: 'Settings file is missing or has wrong "version" field.' };
  }
  const data = obj['data'];
  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: 'Settings file is missing the "data" object.' };
  }
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ok: false, error: 'localStorage unavailable in this environment.' };
  }
  const ls = window.localStorage;
  // Replace policy: clear all existing mcptc:* keys, then write the
  // imported set. Keys not in the import (e.g. session-only state)
  // are left alone — but anything mcptc:*-prefixed gets a clean slate.
  // This is the simplest semantics ("apply the file as-is"); merge /
  // skip policies are a future extension.
  const keysToRemove: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const key = ls.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) ls.removeItem(key);

  let keysWritten = 0;
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith(STORAGE_PREFIX)) continue;
    try {
      ls.setItem(key, JSON.stringify(value));
      keysWritten++;
    } catch {
      // quota or serialise failure — best-effort, continue.
    }
  }
  return {
    ok: true,
    keysWritten,
    credentialsStripped:
      typeof obj['credentialsStripped'] === 'boolean' ? obj['credentialsStripped'] : false,
  };
}

/** Trigger a browser download for an export blob. */
export function downloadExport(
  blob: SettingsExport,
  filename = 'mcp-test-client-settings.json',
): void {
  if (typeof window === 'undefined') return;
  const json = JSON.stringify(blob, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
