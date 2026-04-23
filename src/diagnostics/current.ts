/**
 * Publisher for the "current" diagnostic bundle.
 *
 * React state is not reachable from outside the component tree, so we use
 * a tiny registry: the {@link DiagnosticsPublisher} hook registers a
 * callback that returns the up-to-date bundle. Consumers (UI buttons,
 * the `window.mcpClientDiagnostics()` console helper) call
 * {@link snapshotBundle} to pull the current value.
 */

import type { DiagnosticBundle } from './types.ts';

let provider: (() => DiagnosticBundle) | null = null;

/** Register the current bundle provider. Returns a disposer. */
export function registerBundleProvider(fn: () => DiagnosticBundle): () => void {
  provider = fn;
  return () => {
    if (provider === fn) provider = null;
  };
}

/**
 * Return the current diagnostic bundle, or `null` if no provider has
 * registered yet (e.g., the app hasn't finished mounting).
 */
export function snapshotBundle(): DiagnosticBundle | null {
  return provider ? provider() : null;
}
