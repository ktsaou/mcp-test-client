import { useEffect } from 'react';

import { decodeShareState } from '../share-url/encode.ts';
import { useServers } from '../state/servers.tsx';

/**
 * On first paint, look at the URL hash. If it's a shareable state, materialise
 * it into an in-memory server entry (if not already stored), select that
 * server, and clear the hash so the state lives in React from here on.
 *
 * We do NOT auto-connect even when `state.connect === true`; the recipient
 * still presses Connect manually. This is intentional: see specs/shareable-urls.md
 * §6 (security), and matches the principle that a link must never initiate
 * network traffic to a third-party server without the user's explicit click.
 */
export function ShareUrlLoader() {
  const { servers, add, setActive } = useServers();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    let cancelled = false;
    void (async () => {
      const state = await decodeShareState(hash);
      if (cancelled || !state) return;

      // If we already have this server stored, select it.
      const existing = servers.find((s) => s.url === state.url);
      if (existing) {
        setActive(existing.id);
      } else {
        // Add an in-memory entry. The recipient can "Save" from the sidebar if
        // they want to keep it.
        const created = add({
          name: new URL(state.url).host,
          url: state.url,
          transport: state.t ?? 'auto',
          auth: { kind: 'none' },
        });
        setActive(created.id);
      }

      // Strip the hash so reloads don't re-apply (and so tokens, if any ever
      // sneak in, don't stick in the URL bar).
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    })();

    return () => {
      cancelled = true;
    };
    // Only run on first mount; subsequent updates must not re-interpret the
    // already-consumed hash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
