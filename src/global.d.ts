// Global type declarations for the browser app.
// JSX namespace is provided by @types/react.

declare module '*.css';

declare module '*.svg' {
  const src: string;
  export default src;
}

/** Injected by Vite at build time from package.json version. */
declare const __APP_VERSION__: string;
/** Injected by Vite at build time: short git SHA of the build. */
declare const __GIT_SHA__: string;
/** Injected by Vite at build time: ISO 8601 build timestamp. */
declare const __BUILD_TIME__: string;

interface Window {
  /**
   * Console helper for users reporting bugs. Returns a redacted bundle of
   * the current session (log, connection, environment). Available once the
   * app has mounted; returns `null` before then.
   *
   * Typical use from DevTools:
   *   copy(JSON.stringify(mcpClientDiagnostics(), null, 2))
   *
   * See docs/reporting-bugs.md.
   */
  mcpClientDiagnostics?: () => import('./diagnostics/types.ts').DiagnosticBundle | null;
}
