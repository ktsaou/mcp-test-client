import { useEffect, useRef } from 'react';

import { decodeShareState } from '../share-url/encode.ts';
import { useShareLinkResolver } from '../state/share-link-resolver.tsx';

/**
 * On first paint, look at the URL hash. If it's a shareable state,
 * hand the parsed payload to the share-link resolver and let it walk
 * the recipient through the chain (server-missing → connection-error
 * → tool-not-found → loaded). The loader itself no longer mutates
 * `useServers()` or `useSelection()` directly — that all moved into
 * the resolver per DEC-015 / SOW-0005 D1.
 *
 * The resolver also owns the inbox seeding for `tool/args/raw`; this
 * keeps the share-link path single-sourced. We only retain the hash
 * parse + history-strip here so the URL bar doesn't leak the encoded
 * state on a reload.
 *
 * We do NOT auto-connect even when `state.connect === true`; the
 * recipient still presses Connect manually. This is intentional: see
 * specs/security.md §6 (security), and matches the principle that a
 * link must never initiate network traffic to a third-party server
 * without the user's explicit click.
 */
export function ShareUrlLoader() {
  const resolver = useShareLinkResolver();
  // Guard so we never re-parse an already-consumed hash.
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    const hash = window.location.hash;
    if (!hash) {
      consumedRef.current = true;
      return;
    }

    let cancelled = false;
    void (async () => {
      const state = await decodeShareState(hash);
      if (cancelled) return;
      consumedRef.current = true;
      if (!state) return;

      // Hand off to the resolver. The resolver decides between
      // server-missing modal, direct-to-connecting, etc., based on
      // the current servers list and live connection status. Modals
      // are mounted at the layout level and appear when the
      // resolver's state kind matches.
      resolver.begin({
        url: state.url,
        ...(state.tool !== undefined ? { tool: state.tool } : {}),
        ...(state.args !== undefined ? { args: state.args } : {}),
        ...(state.raw !== undefined ? { raw: state.raw } : {}),
        ...(state.t !== undefined ? { t: state.t } : {}),
      });

      // Strip the hash so reloads don't re-apply (and so tokens, if
      // any ever sneak in, don't stick in the URL bar).
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    })();

    return () => {
      cancelled = true;
    };
    // Only run on first mount; subsequent updates must not re-interpret
    // the already-consumed hash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
