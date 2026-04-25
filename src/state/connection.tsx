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

import { McpClient } from '../mcp/client.ts';
import type { ServerEntry } from '../persistence/schema.ts';
import { useLog } from './log.tsx';

export type ConnectionStatus =
  | { state: 'idle' }
  | { state: 'connecting' }
  | { state: 'connected' }
  | { state: 'error'; error: Error };

/**
 * Outcome of a {@link ConnectionContextValue.connect} call.
 *
 * - `'connected'` — handshake completed, inventory loaded, this client is
 *   the active client. The caller should fire a "connected" toast and
 *   remember the server as recently-used.
 * - `'superseded'` — the call was cancelled mid-flight by a newer
 *   `connect()` to a different server. No UI side-effects should fire;
 *   the new attempt owns the status and the toast.
 *
 * On real connection failures `connect()` throws — caller's `catch`
 * surfaces the error toast.
 */
export type ConnectOutcome = 'connected' | 'superseded';

interface Inventory {
  tools: unknown[];
  prompts: unknown[];
  resources: unknown[];
  resourceTemplates: unknown[];
}

const emptyInventory: Inventory = {
  tools: [],
  prompts: [],
  resources: [],
  resourceTemplates: [],
};

export interface ConnectionContextValue {
  status: ConnectionStatus;
  inventory: Inventory;
  /** The bound MCP client when connected; null otherwise. */
  client: McpClient | null;
  /**
   * Connect to `server`. Cancels any in-flight prior `connect()` —
   * clicking a different sidebar entry while a slow connect is still
   * spinning will abort the prior attempt and start the new one. See
   * the `ConnectOutcome` type for the return-value contract; throws on
   * real connection failures (the caller surfaces a toast on
   * `connected` and on the thrown error; silent on `superseded`).
   */
  connect: (server: ServerEntry) => Promise<ConnectOutcome>;
  disconnect: () => Promise<void>;
}

export const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const log = useLog();
  const [status, setStatus] = useState<ConnectionStatus>({ state: 'idle' });
  const [inventory, setInventory] = useState<Inventory>(emptyInventory);
  const clientRef = useRef<McpClient | null>(null);
  // Monotonic counter that flags an in-flight connect attempt as
  // superseded. A new `connect()` increments it; the prior call's
  // continuations check against the captured value before applying any
  // UI side-effects. Without this, clicking server B while still
  // connecting to server A produced a race where A's eventual
  // success/failure clobbered B's "connecting" status.
  const connectEpochRef = useRef(0);

  const refreshInventory = useCallback(
    async (client: McpClient) => {
      const result: Inventory = { ...emptyInventory };
      const attempt = async <T,>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
        try {
          return await fn();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.appendSystem('warn', `${label} unavailable: ${msg}`);
          return undefined;
        }
      };
      const tools = await attempt('tools/list', () => client.listTools());
      if (tools) result.tools = tools.tools;
      const prompts = await attempt('prompts/list', () => client.listPrompts());
      if (prompts) result.prompts = prompts.prompts;
      const resources = await attempt('resources/list', () => client.listResources());
      if (resources) result.resources = resources.resources;
      const rt = await attempt('resources/templates/list', () => client.listResourceTemplates());
      if (rt) result.resourceTemplates = rt.resourceTemplates;
      setInventory(result);
    },
    [log],
  );

  const connect = useCallback(
    async (server: ServerEntry): Promise<ConnectOutcome> => {
      // Bump the epoch FIRST so any prior in-flight attempt's
      // post-await continuations see a stale value and bail out
      // silently. Snapshot ours so we can detect being superseded.
      const myEpoch = ++connectEpochRef.current;

      // Disconnect any currently-active client. Fire-and-forget — we
      // do NOT await it. Awaiting would block the new connect on the
      // old transport's close (which can hang for tens of seconds when
      // the old server is unresponsive — exactly the case the user is
      // trying to escape from by clicking a different server).
      const previousClient = clientRef.current;
      clientRef.current = null;
      if (previousClient) {
        void previousClient.disconnect().catch(() => undefined);
      }

      setStatus({ state: 'connecting' });
      setInventory(emptyInventory);
      log.appendSystem('info', `Connecting to ${server.url}…`);

      const client = new McpClient({
        onWire: (e) => log.appendWire(e),
        onSchemaWarning: ({ message, schema }) => {
          // The SDK doesn't tell the validator which tool the schema
          // belongs to, so we surface a concise summary the user can
          // grep against the tools/list response, plus the explicit
          // "tool still usable" framing so users don't think the whole
          // listing is broken. The full Ajv source + stack also lands
          // on console.error — we deliberately leave that channel
          // alone (DEC-024).
          const summary = describeSchema(schema);
          log.appendSystem(
            'warn',
            `output schema compile failed (${summary}): ${message} — tool still usable; output validation disabled. Full Ajv detail in browser console.`,
          );
        },
      });

      try {
        await client.connect({
          url: server.url,
          transport: server.transport,
          auth: server.auth ?? { kind: 'none' },
        });
        if (connectEpochRef.current !== myEpoch) {
          // A newer connect() ran while we awaited. Drop our client and
          // leave UI state to the newer attempt.
          void client.disconnect().catch(() => undefined);
          return 'superseded';
        }
        clientRef.current = client;
        setStatus({ state: 'connected' });
        log.appendSystem('info', 'Connected. Fetching inventory…');
        await refreshInventory(client);
        if (connectEpochRef.current !== myEpoch) {
          // Superseded between handshake and inventory load. Same
          // bail-out as above; clientRef may already point at the new
          // client, so only clear it if it's still ours.
          if (clientRef.current === client) clientRef.current = null;
          void client.disconnect().catch(() => undefined);
          return 'superseded';
        }
        log.appendSystem('info', 'Ready.');
        return 'connected';
      } catch (err) {
        // Always tear down our half-built client.
        void client.disconnect().catch(() => undefined);
        if (connectEpochRef.current !== myEpoch) {
          // The throw was almost certainly the prior client's
          // disconnect cascading into our transport (we superseded
          // this attempt ourselves). Stay silent; the new attempt
          // owns the status and the toast.
          return 'superseded';
        }
        const error = err instanceof Error ? err : new Error(String(err));
        setStatus({ state: 'error', error });
        log.appendSystem('error', `Connect failed: ${error.message}`);
        // Re-throw so the UI handler shows a "Connect failed" toast
        // instead of falling through to the success path (the v1.1.11
        // bug Costa flagged: "On timeout, the toast still says
        // 'connected to ...' although the logs show failure").
        throw error;
      }
    },
    [log, refreshInventory],
  );

  const disconnect = useCallback(async () => {
    // Bump the epoch so any in-flight `connect()` (e.g. the user
    // clicked Disconnect mid-handshake) sees itself as superseded
    // and bails out instead of clobbering our `idle` status with
    // its `connected` / `error` state.
    connectEpochRef.current += 1;
    const client = clientRef.current;
    clientRef.current = null;
    setStatus({ state: 'idle' });
    setInventory(emptyInventory);
    if (!client) return;
    await client.disconnect().catch(() => undefined);
    log.appendSystem('info', 'Disconnected.');
  }, [log]);

  useEffect(
    () => () => {
      // Provider unmount: nuke any in-flight connect by bumping the
      // epoch, then close the active client.
      connectEpochRef.current += 1;
      clientRef.current?.disconnect().catch(() => undefined);
    },
    [],
  );

  const value = useMemo<ConnectionContextValue>(
    () => ({ status, inventory, client: clientRef.current, connect, disconnect }),
    [status, inventory, connect, disconnect],
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnection must be used inside <ConnectionProvider>');
  return ctx;
}

/**
 * Best-effort, single-line description of an `outputSchema` to put in a
 * compile-failure warning. The SDK validator hook doesn't tell us which
 * tool the schema came from, so we extract the most distinctive bits we
 * can — type, top-level required keys, and the top-level property names
 * — to help the user grep their tools/list response and find the
 * offender.
 */
function describeSchema(schema: unknown): string {
  if (!schema || typeof schema !== 'object') return 'non-object schema';
  const obj = schema as Record<string, unknown>;
  const type = typeof obj.type === 'string' ? obj.type : 'unknown';
  const required = Array.isArray(obj.required) ? (obj.required as unknown[]).slice(0, 4) : [];
  const props =
    obj.properties && typeof obj.properties === 'object'
      ? Object.keys(obj.properties).slice(0, 6)
      : [];
  const parts = [`type=${type}`];
  if (required.length > 0) parts.push(`required=[${required.join(',')}]`);
  if (props.length > 0) parts.push(`props=[${props.join(',')}]`);
  return parts.join(' ');
}
