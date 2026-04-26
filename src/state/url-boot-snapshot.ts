/**
 * DEC-026 — boot-time snapshot of the URL state.
 *
 * The snapshot is read once at module import (which happens AFTER
 * `main.tsx` runs `migrateDoublePrefix`, because `main.tsx` imports
 * `App.tsx` which transitively imports this module). Providers and
 * panels read the snapshot on their first render to override their
 * own local-storage hydration when the URL is non-silent about a slice.
 *
 * Consume semantics: `consume<Slice>` returns the slice and clears it
 * so a provider that mounts twice (StrictMode double-effect, or
 * remount) does not re-apply a stale URL value over the user's
 * subsequent edits.
 */

import { parse, type UrlState } from './url-state.ts';

// Captured at module-load. `<App>` drains them through the log provider
// once it mounts; a sync warn() at module-load would land before the
// log panel even exists.
const pendingWarnings: string[] = [];

const initial: UrlState =
  typeof window === 'undefined'
    ? {}
    : parse(window.location.search, {
        onWarn: (msg) => {
          pendingWarnings.push(msg);
        },
      });

const remaining: UrlState = { ...initial };

/** Snapshot of the URL on boot. Stable identity, do not mutate. */
export function getBootUrlState(): Readonly<UrlState> {
  return initial;
}

/** Consume + clear the `server` slice (one-shot). */
export function consumeBootServer(): string | undefined {
  const v = remaining.server;
  delete remaining.server;
  return v;
}

/** Consume + clear the `tool` / `args` / `mode` slices together. */
export function consumeBootToolAndArgs(): {
  tool?: string;
  args?: unknown;
  mode?: 'form' | 'raw';
} {
  const out: { tool?: string; args?: unknown; mode?: 'form' | 'raw' } = {};
  if (remaining.tool !== undefined) out.tool = remaining.tool;
  if (remaining.args !== undefined) out.args = remaining.args;
  if (remaining.mode !== undefined) out.mode = remaining.mode;
  delete remaining.tool;
  delete remaining.args;
  delete remaining.mode;
  return out;
}

/** Consume + clear the `log_filter` slice. */
export function consumeBootLogFilter(): UrlState['logFilter'] | undefined {
  const v = remaining.logFilter;
  delete remaining.logFilter;
  return v;
}

/** Drain warnings captured during the boot parse. */
export function drainBootWarnings(): string[] {
  const out = pendingWarnings.slice();
  pendingWarnings.length = 0;
  return out;
}

/**
 * Test hook — re-read the current URL into the snapshot. Production
 * code never calls this; tests use it to simulate a fresh boot
 * without reloading the test runner.
 */
export function __resetBootUrlSnapshotForTests(): void {
  for (const k of Object.keys(remaining) as Array<keyof UrlState>) {
    delete remaining[k];
  }
  pendingWarnings.length = 0;
  if (typeof window === 'undefined') return;
  const fresh = parse(window.location.search, {
    onWarn: (msg) => {
      pendingWarnings.push(msg);
    },
  });
  Object.assign(remaining, fresh);
  // initial keeps its original identity but its content updates so
  // tests asserting on getBootUrlState() observe the reset.
  for (const k of Object.keys(initial) as Array<keyof UrlState>) {
    delete initial[k];
  }
  Object.assign(initial, fresh);
}
