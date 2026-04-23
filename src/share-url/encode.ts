/**
 * Shareable-URL encoder / decoder. See specs/shareable-urls.md.
 *
 * The serialization is deliberately small and self-contained:
 *   - URL-safe base64 of a compressed JSON blob in the hash fragment,
 *     preceded by `s=`.
 *   - Compression uses the browser's native CompressionStream('deflate-raw')
 *     when available; otherwise falls back to plain JSON.
 *   - Tokens are never included, even when the active server has auth;
 *     the recipient must configure their own.
 */

import type { TransportKind } from '../mcp/types.ts';

export interface ShareState {
  v: 1;
  url: string;
  t?: TransportKind;
  tool?: string;
  args?: unknown;
  raw?: string;
  connect?: boolean;
}

export async function encodeShareState(state: ShareState): Promise<string> {
  const json = JSON.stringify(state);
  const compressed = await tryDeflate(json);
  return 's=' + toBase64Url(compressed ?? new TextEncoder().encode(json));
}

export async function decodeShareState(fragment: string): Promise<ShareState | null> {
  if (!fragment) return null;
  const hash = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (!hash.startsWith('s=')) return null;
  const payload = hash.slice(2);
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(payload);
  } catch {
    return null;
  }
  const json = (await tryInflate(bytes)) ?? new TextDecoder().decode(bytes);
  try {
    const parsed = JSON.parse(json) as unknown;
    if (isShareState(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function isShareState(value: unknown): value is ShareState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v['v'] === 1 && typeof v['url'] === 'string';
}

async function tryDeflate(input: string): Promise<Uint8Array | null> {
  const CompressionStreamCtor = (globalThis as { CompressionStream?: typeof CompressionStream })
    .CompressionStream;
  if (!CompressionStreamCtor) return null;
  try {
    const stream = new CompressionStreamCtor('deflate-raw');
    const blob = await new Response(new Blob([input]).stream().pipeThrough(stream)).arrayBuffer();
    return new Uint8Array(blob);
  } catch {
    return null;
  }
}

async function tryInflate(input: Uint8Array): Promise<string | null> {
  const DecompressionStreamCtor = (
    globalThis as { DecompressionStream?: typeof DecompressionStream }
  ).DecompressionStream;
  if (!DecompressionStreamCtor) return null;
  try {
    const stream = new DecompressionStreamCtor('deflate-raw');
    // Copy to a plain ArrayBuffer so Blob's type constraints are satisfied
    // across TS lib variants where Uint8Array may be SharedArrayBuffer-backed.
    const buffer = new ArrayBuffer(input.byteLength);
    new Uint8Array(buffer).set(input);
    const text = await new Response(new Blob([buffer]).stream().pipeThrough(stream)).text();
    return text;
  } catch {
    return null;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  const b64 = btoa(s);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
