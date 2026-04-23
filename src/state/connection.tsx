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

interface ConnectionContextValue {
  status: ConnectionStatus;
  inventory: Inventory;
  /** The bound MCP client when connected; null otherwise. */
  client: McpClient | null;
  connect: (server: ServerEntry) => Promise<void>;
  disconnect: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const log = useLog();
  const [status, setStatus] = useState<ConnectionStatus>({ state: 'idle' });
  const [inventory, setInventory] = useState<Inventory>(emptyInventory);
  const clientRef = useRef<McpClient | null>(null);

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
    async (server: ServerEntry) => {
      if (clientRef.current) {
        await clientRef.current.disconnect().catch(() => undefined);
        clientRef.current = null;
      }
      setStatus({ state: 'connecting' });
      setInventory(emptyInventory);
      log.appendSystem('info', `Connecting to ${server.url}…`);

      const client = new McpClient({
        onWire: (e) => log.appendWire(e),
      });

      try {
        await client.connect({
          url: server.url,
          transport: server.transport,
          auth: server.auth ?? { kind: 'none' },
        });
        clientRef.current = client;
        setStatus({ state: 'connected' });
        log.appendSystem('info', 'Connected. Fetching inventory…');
        await refreshInventory(client);
        log.appendSystem('info', 'Ready.');
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setStatus({ state: 'error', error });
        log.appendSystem('error', `Connect failed: ${error.message}`);
        await client.disconnect().catch(() => undefined);
      }
    },
    [log, refreshInventory],
  );

  const disconnect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      setStatus({ state: 'idle' });
      return;
    }
    await client.disconnect().catch(() => undefined);
    clientRef.current = null;
    setStatus({ state: 'idle' });
    setInventory(emptyInventory);
    log.appendSystem('info', 'Disconnected.');
  }, [log]);

  useEffect(
    () => () => {
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
