import { useEffect, useRef } from 'react';

import { decodeShareState, type ShareState } from '../share-url/encode.ts';
import { useConnection } from '../state/connection.tsx';
import { useSelection } from '../state/selection.tsx';
import { useServers } from '../state/servers.tsx';
import type { Selection } from './inspector.tsx';

/**
 * On first paint, look at the URL hash. If it's a shareable state, materialise
 * it into an in-memory server entry (if not already stored), select that
 * server, and clear the hash so the state lives in React from here on.
 *
 * Tool selection and form pre-fill cannot be applied until the connection
 * settles and the inventory is fetched. We therefore stash `tool/args/raw`
 * in the share inbox and watch the connection: once `status === connected`
 * and the matching tool appears in the inventory, we set the selection and
 * the request panel reads the inbox's args/raw.
 *
 * We do NOT auto-connect even when `state.connect === true`; the recipient
 * still presses Connect manually. This is intentional: see specs/security.md
 * §6 (security), and matches the principle that a link must never initiate
 * network traffic to a third-party server without the user's explicit click.
 */
export function ShareUrlLoader() {
  const { servers, add, setActive } = useServers();
  const { setSelection, setInbox } = useSelection();
  const { status, inventory } = useConnection();

  // The share state we are still waiting to materialise (because the
  // recipient hasn't connected yet). Once consumed, this becomes null.
  const pendingRef = useRef<ShareState | null>(null);
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

      // Stash tool/args/raw to be applied once the user connects and the
      // inventory lists the tool. Setting the inbox unconditionally is safe;
      // the request panel only reads it on a matching tool selection.
      if (state.tool || state.args !== undefined || state.raw !== undefined) {
        pendingRef.current = state;
        setInbox({
          ...(state.tool !== undefined ? { tool: state.tool } : {}),
          ...(state.args !== undefined ? { args: state.args } : {}),
          ...(state.raw !== undefined ? { raw: state.raw } : {}),
        });
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

  // Once the connection settles and the inventory shows the requested tool,
  // pre-select it. The request panel reads the inbox on selection-change.
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || !pending.tool) return;
    if (status.state !== 'connected') return;
    const tool = (inventory.tools as Array<Record<string, unknown>>).find(
      (t) => t['name'] === pending.tool,
    );
    if (!tool) return;

    const selection: Selection = {
      kind: 'tools',
      name: pending.tool,
      payload: tool,
    };
    setSelection(selection);
    pendingRef.current = null;
  }, [status, inventory, setSelection]);

  return null;
}
