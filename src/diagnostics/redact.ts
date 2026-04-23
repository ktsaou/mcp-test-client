/**
 * Credential redaction for diagnostic bundles.
 *
 * Rules:
 * - A redacted secret reveals its **length** and, when length >= 8, the
 *   first 2 + last 2 characters so a reporter can verify which token they
 *   shared without exposing the full value.
 * - Short secrets (< 8 chars) are fully masked — no preview.
 * - Empty strings are treated as "no secret".
 */

import type { RedactedServer, UnredactedServer } from './types.ts';

/** Shape preview: `"ab…yz"` for a token like `"abcdefghijkl…xyz"`. */
export function tokenPreview(value: string): string {
  if (!value) return '';
  if (value.length < 8) return '…';
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

export function redactServer(server: UnredactedServer): RedactedServer {
  const { id, name, url, transport } = server;

  if (!server.auth || server.auth.kind === 'none') {
    return { id, name, url, transport, auth: { kind: 'none' } };
  }

  if (server.auth.kind === 'bearer') {
    const token = server.auth.token ?? '';
    return {
      id,
      name,
      url,
      transport,
      auth: {
        kind: 'bearer',
        tokenLength: token.length,
        tokenPreview: tokenPreview(token),
      },
    };
  }

  // header auth
  const v = server.auth.value ?? '';
  return {
    id,
    name,
    url,
    transport,
    auth: {
      kind: 'header',
      name: server.auth.name,
      valueLength: v.length,
      valuePreview: tokenPreview(v),
    },
  };
}
