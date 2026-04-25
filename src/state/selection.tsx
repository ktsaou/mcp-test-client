import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { Selection } from '../ui/inspector.tsx';

/**
 * "Inbox" deposited by the share-URL loader. The recipient must click
 * Connect themselves; once the connection settles and the inventory lists
 * the saved tool, the request panel reads the inbox, applies it once, and
 * clears it.
 *
 *   - `tool`: the saved tool name to select.
 *   - `args`: pre-fill the form value for the selected tool.
 *   - `raw`: pre-fill the raw editor instead (mutually exclusive with args).
 */
export interface ShareInbox {
  tool?: string;
  args?: unknown;
  raw?: string;
}

interface SelectionContextValue {
  selection: Selection | null;
  setSelection: (next: Selection | null) => void;
  /** One-shot data deposited by the share-URL loader. Re-renders consumers. */
  inbox: ShareInbox | null;
  setInbox: (next: ShareInbox | null) => void;
  /** Read-and-clear in one call; safe against double-application. */
  consumeInbox: () => ShareInbox | null;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [inbox, setInboxState] = useState<ShareInbox | null>(null);
  // Mirror the latest inbox in a ref so consumeInbox can return the current
  // value synchronously even before React commits the cleared state.
  const inboxRef = useRef<ShareInbox | null>(null);

  const setInbox = useCallback((next: ShareInbox | null) => {
    inboxRef.current = next;
    setInboxState(next);
  }, []);

  const consumeInbox = useCallback((): ShareInbox | null => {
    const snapshot = inboxRef.current;
    if (snapshot === null) return null;
    inboxRef.current = null;
    setInboxState(null);
    return snapshot;
  }, []);

  const value = useMemo<SelectionContextValue>(
    () => ({ selection, setSelection, inbox, setInbox, consumeInbox }),
    [selection, inbox, setInbox, consumeInbox],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used inside <SelectionProvider>');
  return ctx;
}
