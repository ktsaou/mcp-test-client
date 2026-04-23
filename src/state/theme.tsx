import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { Keys, type ThemePreference } from '../persistence/schema.ts';
import { appStore } from './store-instance.ts';

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyToDocument(pref: ThemePreference): void {
  document.documentElement.setAttribute('data-theme', pref);
}

/**
 * Reads the user's saved theme preference, applies it to <html data-theme>,
 * and exposes a setter that persists and reapplies.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const saved = appStore.read<ThemePreference>(Keys.theme);
    return saved === 'system' || saved === 'dark' || saved === 'light' ? saved : 'dark';
  });

  useEffect(() => {
    applyToDocument(preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    appStore.write(Keys.theme, next);
    setPreferenceState(next);
  }, []);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
