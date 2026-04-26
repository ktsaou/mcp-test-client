/**
 * Share-link resolver — auto-advancing state machine for the
 * recipient flow defined in DEC-015 Part B (SOW-0005 chunk B, D1).
 *
 * Why: the share-link loader (`src/ui/share-url-loader.tsx`) used to
 * silently materialise an in-memory server and hope the user figured
 * out the rest. DEC-015 makes the chain explicit — server missing →
 * connect failed → tool not found → loaded — and surfaces each step
 * as a modal that explains what happened and how to proceed.
 *
 * The provider holds a discriminated-union state and a single effect
 * that watches `useConnection().status`, `useServers().servers`, and
 * `inventory.tools`. After a modal closes, the effect re-evaluates
 * and (if needed) advances to the next state. Modals dispatch back
 * through the resolve* actions; they never own state themselves.
 *
 * Architectural notes:
 *   - Per D2: B.2 has no auto-retry. "Open server settings" opens
 *     the existing ServerModal in edit mode via the same custom
 *     event the command palette already uses (DEC-025); the user
 *     fixes auth and clicks Connect manually.
 *   - Per D3: B.3 "Open as raw" builds a full JSON-RPC tools/call
 *     envelope and writes it through the SelectionContext inbox so
 *     the request panel reads it on its existing inbox path.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { TransportKind } from '../mcp/types.ts';
import { useConnection } from './connection.tsx';
import { useSelection } from './selection.tsx';
import { useServers } from './servers.tsx';

export type ResolverState =
  | { kind: 'idle' }
  | {
      kind: 'server-missing';
      url: string;
      tool?: string;
      args?: unknown;
      raw?: string;
      t?: TransportKind;
    }
  | { kind: 'connecting'; serverId: string; tool?: string; args?: unknown; raw?: string }
  | { kind: 'connection-error'; error: Error; serverId: string }
  | {
      kind: 'tool-not-found';
      tool: string;
      args?: unknown;
      raw?: string;
      serverId: string;
      url: string;
    }
  | { kind: 'loaded' };

/** What the share-url-loader hands the resolver after parsing the hash. */
export interface ShareLinkPayload {
  url: string;
  tool?: string;
  args?: unknown;
  raw?: string;
  t?: TransportKind;
}

interface ResolverApi {
  state: ResolverState;
  /** Called by the loader once the share-link hash has been parsed. */
  begin: (payload: ShareLinkPayload) => void;
  resolveServerMissing: (action: 'add' | 'cancel') => void;
  resolveConnectionError: (action: 'open-settings' | 'cancel') => void;
  resolveToolNotFound: (action: 'open-raw' | 'cancel') => void;
}

const Ctx = createContext<ResolverApi | null>(null);

export function ShareLinkResolverProvider({ children }: { children: ReactNode }) {
  const { servers, add, setActive } = useServers();
  const { status, inventory } = useConnection();
  const { setInbox, setSelection } = useSelection();

  const [state, setState] = useState<ResolverState>({ kind: 'idle' });

  // Hold the live state in a ref so the watcher effect can read the
  // latest kind without retriggering when state itself changes (the
  // effect's job is to react to the *external* signals — connection
  // status, inventory, server list — not its own dispatches).
  const stateRef = useRef(state);
  stateRef.current = state;

  // What the user shared, kept across state transitions so we can
  // pre-fill the inbox once the server is connected and the tool is
  // found in inventory.
  const payloadRef = useRef<ShareLinkPayload | null>(null);
  // Tracks the Error instance we have already shown the user via the
  // ConnectionFailedModal. After "Open server settings" fires we set
  // this so the watcher does NOT re-flip back to connection-error on
  // the very next render — it waits for a fresh status transition
  // (connecting → error) with a NEW Error instance, exactly per D2's
  // "after the user re-clicks Connect" framing.
  const handledErrorRef = useRef<Error | null>(null);

  const begin = useCallback(
    (payload: ShareLinkPayload) => {
      payloadRef.current = payload;
      const existing = servers.find((s) => s.url === payload.url);
      if (!existing) {
        setState({
          kind: 'server-missing',
          url: payload.url,
          ...(payload.tool !== undefined ? { tool: payload.tool } : {}),
          ...(payload.args !== undefined ? { args: payload.args } : {}),
          ...(payload.raw !== undefined ? { raw: payload.raw } : {}),
          ...(payload.t !== undefined ? { t: payload.t } : {}),
        });
        return;
      }
      // Server already saved: select it and let the watcher advance
      // through the connection / tool checks.
      setActive(existing.id);
      setState({
        kind: 'connecting',
        serverId: existing.id,
        ...(payload.tool !== undefined ? { tool: payload.tool } : {}),
        ...(payload.args !== undefined ? { args: payload.args } : {}),
        ...(payload.raw !== undefined ? { raw: payload.raw } : {}),
      });
    },
    [servers, setActive],
  );

  const resolveServerMissing = useCallback(
    (action: 'add' | 'cancel') => {
      const current = stateRef.current;
      if (current.kind !== 'server-missing') return;
      if (action === 'cancel') {
        payloadRef.current = null;
        setState({ kind: 'idle' });
        return;
      }
      // Persist a real ServerEntry — DEC-015 line 90: "create a real
      // persisted ServerEntry (not just in-memory)". Auth is always
      // 'none'; the recipient configures their own from the sidebar.
      const created = add({
        name: new URL(current.url).host,
        url: current.url,
        transport: current.t ?? 'auto',
        auth: { kind: 'none' },
      });
      setActive(created.id);
      setState({
        kind: 'connecting',
        serverId: created.id,
        ...(current.tool !== undefined ? { tool: current.tool } : {}),
        ...(current.args !== undefined ? { args: current.args } : {}),
        ...(current.raw !== undefined ? { raw: current.raw } : {}),
      });
    },
    [add, setActive],
  );

  const resolveConnectionError = useCallback((action: 'open-settings' | 'cancel') => {
    const current = stateRef.current;
    if (current.kind !== 'connection-error') return;
    if (action === 'cancel') {
      payloadRef.current = null;
      handledErrorRef.current = null;
      setState({ kind: 'idle' });
      return;
    }
    // D2 — open the existing ServerModal via the same custom event
    // the command palette uses (DEC-025). The user edits auth and
    // clicks Connect manually; auto-retry would violate the
    // no-auto-connect security rule. Record the Error instance so
    // the watcher does not immediately re-fire the modal on its
    // next pass — it only re-fires when a NEW error surfaces.
    handledErrorRef.current = current.error;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('mcptc:command-palette', {
          detail: { type: 'edit-server', id: current.serverId },
        }),
      );
    }
    // Drop back to connecting so the watcher effect picks up the
    // next status flip when the user re-clicks Connect.
    setState({ kind: 'connecting', serverId: current.serverId });
  }, []);

  const resolveToolNotFound = useCallback(
    (action: 'open-raw' | 'cancel') => {
      const current = stateRef.current;
      if (current.kind !== 'tool-not-found') return;
      if (action === 'cancel') {
        payloadRef.current = null;
        setState({ kind: 'idle' });
        return;
      }
      // D3 — pre-build the JSON-RPC envelope the user can send as-is
      // or edit. The request panel only reads `inbox` once it has a
      // matching tool selection (request-panel.tsx:178-182), and it
      // shows an empty-state when `selection === null`. Since the
      // tool is absent from the live inventory we cannot point at a
      // real inventory row — we drop a synthetic Selection (no
      // inputSchema → request panel falls through to the raw
      // textarea per request-panel.tsx:638-655) and pair it with an
      // inbox carrying the same tool name + the rendered envelope.
      const envelope = JSON.stringify(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: current.tool, arguments: current.args ?? {} },
        },
        null,
        2,
      );
      setSelection({
        kind: 'tools',
        name: current.tool,
        payload: { name: current.tool },
      });
      setInbox({ tool: current.tool, raw: envelope });
      payloadRef.current = null;
      setState({ kind: 'loaded' });
    },
    [setInbox, setSelection],
  );

  // Auto-advance watcher. Re-evaluates whenever the external signals
  // (servers / status / inventory) change OR our own state changes,
  // because both directions can unblock a transition (e.g. B.1's
  // "Add" produces a new server entry on the next render).
  useEffect(() => {
    const current = stateRef.current;

    if (current.kind === 'connecting') {
      // Connection error → modal that surfaces it. Skip if this
      // exact Error instance was already handled by the user
      // clicking "Open server settings" — the next genuine flip to
      // an error will carry a new Error instance.
      if (status.state === 'error') {
        if (handledErrorRef.current === status.error) return;
        setState({ kind: 'connection-error', error: status.error, serverId: current.serverId });
        return;
      }
      // Status changed to non-error — clear the handled-error guard
      // so a future error after this point produces a fresh modal.
      if (handledErrorRef.current !== null) {
        handledErrorRef.current = null;
      }
      // Connected and inventory available → check tool presence.
      if (status.state === 'connected') {
        const wantedTool = current.tool ?? payloadRef.current?.tool;
        if (!wantedTool) {
          // No tool requested — apply remaining args/raw via inbox
          // (rare path, but supports share links that only carry a
          // server URL).
          const payload = payloadRef.current;
          if (payload && (payload.args !== undefined || payload.raw !== undefined)) {
            setInbox({
              ...(payload.args !== undefined ? { args: payload.args } : {}),
              ...(payload.raw !== undefined ? { raw: payload.raw } : {}),
            });
          }
          payloadRef.current = null;
          setState({ kind: 'loaded' });
          return;
        }
        const matchedTool = (inventory.tools as Array<Record<string, unknown>>).find(
          (t) => t['name'] === wantedTool,
        );
        if (matchedTool) {
          // Pre-fill the inbox so the request panel applies the args
          // / raw payload on its next render — and explicitly set
          // selection (mirroring the pre-refactor share-url-loader)
          // because inbox alone doesn't drive selection: the request
          // panel reads inbox in its own selection-change effect, and
          // RestoreSelectionOnServerReady (App.tsx) only knows about
          // the URL boot snapshot, not the share-link inbox.
          const payload = payloadRef.current;
          setInbox({
            tool: wantedTool,
            ...(payload?.args !== undefined ? { args: payload.args } : {}),
            ...(payload?.raw !== undefined ? { raw: payload.raw } : {}),
          });
          setSelection({
            kind: 'tools',
            name: wantedTool,
            payload: matchedTool,
          });
          payloadRef.current = null;
          setState({ kind: 'loaded' });
          return;
        }
        // Inventory loaded but tool absent — surface the modal.
        // (When inventory loads in chunks, status flips to
        // 'connected' only after the inventory call settles, so by
        // the time we reach here `inventory.tools` is the final
        // list, not a partial.)
        const url = servers.find((s) => s.id === current.serverId)?.url ?? '';
        setState({
          kind: 'tool-not-found',
          tool: wantedTool,
          ...(current.args !== undefined ? { args: current.args } : {}),
          ...(current.raw !== undefined ? { raw: current.raw } : {}),
          serverId: current.serverId,
          url,
        });
        return;
      }
    }
  }, [status, inventory, servers, setInbox, setSelection, state]);

  const value = useMemo<ResolverApi>(
    () => ({ state, begin, resolveServerMissing, resolveConnectionError, resolveToolNotFound }),
    [state, begin, resolveServerMissing, resolveConnectionError, resolveToolNotFound],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShareLinkResolver(): ResolverApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useShareLinkResolver must be used inside <ShareLinkResolverProvider>');
  return ctx;
}
