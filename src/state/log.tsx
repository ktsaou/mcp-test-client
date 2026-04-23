import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { WireEvent } from '../mcp/types.ts';

/** Upper bound on events kept in memory at once. */
const LOG_CAP = 500;

export type LogEntry =
  | (WireEvent & { kind: 'wire'; id: number })
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

export function LogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const nextIdRef = useRef(1);

  const appendEntry = useCallback((make: (id: number) => LogEntry) => {
    const id = nextIdRef.current++;
    setEntries((prev) => {
      const combined = [...prev, make(id)];
      return combined.length > LOG_CAP ? combined.slice(combined.length - LOG_CAP) : combined;
    });
  }, []);

  const appendWire = useCallback(
    (event: WireEvent) => {
      appendEntry((id) => ({ kind: 'wire', id, ...event }));
    },
    [appendEntry],
  );

  const appendSystem = useCallback(
    (level: 'info' | 'warn' | 'error', text: string) => {
      appendEntry((id) => ({ kind: 'system', id, level, text, timestamp: Date.now() }));
    },
    [appendEntry],
  );

  const clear = useCallback(() => setEntries([]), []);

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
