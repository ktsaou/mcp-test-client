/**
 * DEC-027 — sidebar collapse state. Lifted into context so the global
 * `s` shortcut can flip it without reaching into `<Layout>`'s
 * internals. The desktop layout reads `collapsed` and drives the
 * imperative `panelRef.current.collapse()` / `expand()` calls on the
 * `react-resizable-panels` sidebar Panel. The mobile layout (Drawer)
 * ignores this state — pressing `s` on a phone is a no-op rather
 * than fighting with the drawer the user opens via the hamburger.
 *
 * Persisted under `mcptc:ui.sidebar-collapsed` so the user's
 * preference survives reload.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { uiKey } from '../persistence/schema.ts';
import { appStore } from './store-instance.ts';

interface SidebarCollapseContextValue {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggleCollapsed: () => void;
}

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null);

const STORE_KEY = uiKey('sidebar-collapsed');

function readPersisted(): boolean {
  return appStore.read<boolean>(STORE_KEY) === true;
}

export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState<boolean>(() => readPersisted());

  useEffect(() => {
    appStore.write(STORE_KEY, collapsed);
  }, [collapsed]);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => !prev);
  }, []);

  const value = useMemo<SidebarCollapseContextValue>(
    () => ({ collapsed, setCollapsed, toggleCollapsed }),
    [collapsed, setCollapsed, toggleCollapsed],
  );

  return (
    <SidebarCollapseContext.Provider value={value}>{children}</SidebarCollapseContext.Provider>
  );
}

export function useSidebarCollapse(): SidebarCollapseContextValue {
  const ctx = useContext(SidebarCollapseContext);
  if (!ctx) throw new Error('useSidebarCollapse must be used inside <SidebarCollapseProvider>');
  return ctx;
}
