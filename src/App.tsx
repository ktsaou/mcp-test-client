import { useEffect } from 'react';

/**
 * Placeholder shell. The real UI lands incrementally across
 * Phases 4–7 of TODO-MODERNIZATION.md.
 */
export function App() {
  useEffect(() => {
    // Dark theme default — Phase 4 will replace this with a proper
    // ThemeProvider reading from localStorage.
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  return (
    <main
      style={{
        display: 'grid',
        placeItems: 'center',
        height: '100%',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>MCP Test Client</h1>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
          v1.0 rewrite in progress — see <code>TODO-MODERNIZATION.md</code> for the live plan.
        </p>
      </div>
    </main>
  );
}
