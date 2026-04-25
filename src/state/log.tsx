import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { JSONRPCMessage, WireEvent } from '../mcp/types.ts';

/** Upper bound on events kept in memory at once. */
const LOG_CAP = 500;

/**
 * Per-message metrics surfaced in the UI (DEC-009).
 *
 * Bytes and duration are captured synchronously when the response lands;
 * `tokens` is computed lazily by the renderer (gpt-tokenizer) since the
 * encoder data is large and not all rows ever get expanded.
 */
export interface WireMetrics {
  /** End-to-end duration: response timestamp − paired-request timestamp (ms). */
  durationMs?: number;
}

export type LogEntry =
  | (WireEvent & { kind: 'wire'; id: number; metrics?: WireMetrics })
  | {
      kind: 'system';
      id: number;
      level: 'info' | 'warn' | 'error';
      text: string;
      timestamp: number;
    };

interface LogContextValue {
  entries: LogEntry[];
  appendWire: (event: WireEvent) => void;
  appendSystem: (level: 'info' | 'warn' | 'error', text: string) => void;
  clear: () => void;
}

const LogContext = createContext<LogContextValue | null>(null);

function rpcId(message: JSONRPCMessage): string | number | undefined {
  if ('id' in message && (typeof message.id === 'string' || typeof message.id === 'number')) {
    return message.id;
  }
  return undefined;
}

function isResponseMessage(message: JSONRPCMessage): boolean {
  return !('method' in message) && rpcId(message) !== undefined;
}

function isRequestMessage(message: JSONRPCMessage): boolean {
  return 'method' in message && typeof message.method === 'string' && rpcId(message) !== undefined;
}

export function LogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const nextIdRef = useRef(1);
  // Pending request timestamps keyed by JSON-RPC id, used to compute the
  // end-to-end duration on the matching response (DEC-009).
  const pendingRef = useRef<Map<string | number, number>>(new Map());

  const appendEntry = useCallback((make: (id: number) => LogEntry) => {
    const id = nextIdRef.current++;
    setEntries((prev) => {
      const combined = [...prev, make(id)];
      return combined.length > LOG_CAP ? combined.slice(combined.length - LOG_CAP) : combined;
    });
  }, []);

  const appendWire = useCallback(
    (event: WireEvent) => {
      // Stash the request timestamp so we can compute durationMs when the
      // response arrives; clear the entry on response.
      const id = rpcId(event.message);
      let metrics: WireMetrics | undefined;
      if (id !== undefined) {
        if (event.direction === 'outgoing' && isRequestMessage(event.message)) {
          pendingRef.current.set(id, event.timestamp);
        } else if (event.direction === 'incoming' && isResponseMessage(event.message)) {
          const sentAt = pendingRef.current.get(id);
          if (sentAt !== undefined) {
            metrics = { durationMs: Math.max(0, event.timestamp - sentAt) };
            pendingRef.current.delete(id);
          }
        }
      }
      appendEntry((entryId) => ({ kind: 'wire', id: entryId, ...event, metrics }));
    },
    [appendEntry],
  );

  const appendSystem = useCallback(
    (level: 'info' | 'warn' | 'error', text: string) => {
      appendEntry((id) => ({ kind: 'system', id, level, text, timestamp: Date.now() }));
    },
    [appendEntry],
  );

  const clear = useCallback(() => {
    pendingRef.current.clear();
    setEntries([]);
  }, []);

  const value = useMemo<LogContextValue>(
    () => ({ entries, appendWire, appendSystem, clear }),
    [entries, appendWire, appendSystem, clear],
  );

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>;
}

export function useLog(): LogContextValue {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error('useLog must be used inside <LogProvider>');
  return ctx;
}
