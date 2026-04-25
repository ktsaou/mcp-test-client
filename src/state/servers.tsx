import { nanoid } from 'nanoid';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { Keys, type ServerEntry } from '../persistence/schema.ts';
import { appStore } from './store-instance.ts';

interface ServersContextValue {
  servers: ServerEntry[];
  activeId: string | null;
  active: ServerEntry | null;
  add: (entry: Omit<ServerEntry, 'id' | 'addedAt' | 'lastUsed'>) => ServerEntry;
  update: (id: string, patch: Partial<ServerEntry>) => void;
  remove: (id: string) => void;
  setActive: (id: string | null) => void;
  markUsed: (id: string) => void;
}

const ServersContext = createContext<ServersContextValue | null>(null);

function load(): ServerEntry[] {
  const raw = appStore.read<ServerEntry[]>(Keys.servers);
  return Array.isArray(raw) ? raw : [];
}

function save(servers: ServerEntry[]): void {
  appStore.write(Keys.servers, servers);
}

export function ServersProvider({ children }: { children: ReactNode }) {
  const [servers, setServers] = useState<ServerEntry[]>(() => load());
  const [activeId, setActiveIdState] = useState<string | null>(
    () => appStore.read<string | null>(Keys.serversActive) ?? null,
  );

  useEffect(() => {
    save(servers);
  }, [servers]);

  useEffect(() => {
    appStore.write(Keys.serversActive, activeId);
  }, [activeId]);

  const add = useCallback(
    (entry: Omit<ServerEntry, 'id' | 'addedAt' | 'lastUsed'>): ServerEntry => {
      const full: ServerEntry = {
        ...entry,
        id: nanoid(8),
        addedAt: Date.now(),
        lastUsed: null,
      };
      setServers((prev) => [...prev, full]);
      return full;
    },
    [],
  );

  const update = useCallback((id: string, patch: Partial<ServerEntry>) => {
    setServers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, id } : s)));
  }, []);

  const remove = useCallback((id: string) => {
    let removedUrl: string | undefined;
    setServers((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) removedUrl = target.url;
      return prev.filter((s) => s.id !== id);
    });
    setActiveIdState((current) => (current === id ? null : current));
    // DEC-017: tombstone the URL so the next catalog auto-merge skips
    // it. Stored URLs that don't match catalog entries (user-added
    // servers) are harmless — the auto-merge only checks against
    // catalog URLs.
    if (removedUrl !== undefined) {
      const existing = appStore.read<string[]>(Keys.catalogTombstones) ?? [];
      if (!existing.includes(removedUrl)) {
        appStore.write(Keys.catalogTombstones, [...existing, removedUrl]);
      }
    }
  }, []);

  const setActive = useCallback((id: string | null) => {
    setActiveIdState(id);
  }, []);

  const markUsed = useCallback((id: string) => {
    setServers((prev) => prev.map((s) => (s.id === id ? { ...s, lastUsed: Date.now() } : s)));
  }, []);

  const active = useMemo(() => servers.find((s) => s.id === activeId) ?? null, [servers, activeId]);

  const value = useMemo<ServersContextValue>(
    () => ({ servers, activeId, active, add, update, remove, setActive, markUsed }),
    [servers, activeId, active, add, update, remove, setActive, markUsed],
  );

  return <ServersContext.Provider value={value}>{children}</ServersContext.Provider>;
}

export function useServers(): ServersContextValue {
  const ctx = useContext(ServersContext);
  if (!ctx) throw new Error('useServers must be used inside <ServersProvider>');
  return ctx;
}
