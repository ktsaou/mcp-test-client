/**
 * localStorage-backed panel size hook.
 *
 * Layout panels (log, sidebar) are user-resizable. We store the chosen
 * size under the `mcptc:ui.` namespace so the app remembers across reloads
 * and the other layout state persistence already scoped to that prefix.
 */

import { useCallback, useEffect, useState } from 'react';

import { appStore } from '../state/store-instance.ts';
import { uiKey } from '../persistence/schema.ts';

export interface PanelSizeBounds {
  min: number;
  max: number;
  default: number;
}

/**
 * Returns `[size, setSize]` where `size` is guaranteed to fall within
 * `bounds.min..bounds.max`. Persisted to localStorage under
 * `mcptc:ui.<feature>`.
 */
export function usePanelSize(
  feature: string,
  bounds: PanelSizeBounds,
): [number, (value: number) => void] {
  const [size, setLocalSize] = useState<number>(() => {
    const stored = appStore.read<number>(uiKey(feature));
    const seed = typeof stored === 'number' && Number.isFinite(stored) ? stored : bounds.default;
    return clamp(seed, bounds.min, bounds.max);
  });

  // Re-clamp if bounds tighten (e.g., viewport got smaller).
  useEffect(() => {
    setLocalSize((current) => clamp(current, bounds.min, bounds.max));
  }, [bounds.min, bounds.max]);

  const setSize = useCallback(
    (value: number) => {
      const clamped = clamp(value, bounds.min, bounds.max);
      setLocalSize(clamped);
      appStore.write(uiKey(feature), clamped);
    },
    [feature, bounds.min, bounds.max],
  );

  return [size, setSize];
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
