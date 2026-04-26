import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { snapshotBundle } from './diagnostics/current.ts';
import { migrateDoublePrefix } from './persistence/migrations.ts';

// Mantine styles must come before our overrides so theme.css / shell.css
// can lean on Mantine CSS variables and selectively override them.
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';

import './ui/theme.css';
import './ui/shell.css';
import './ui/json-view.css';
import './ui/log-panel.css';
import './ui/command-palette.css';
import './schema-form/schema-form.css';

// Run before React mounts so any consumer that reads `mcptc:*` on first
// render sees the already-rewritten keys.
if (typeof window !== 'undefined' && window.localStorage) {
  migrateDoublePrefix(window.localStorage);
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found in index.html');

// Expose the diagnostics helper for users reporting bugs from DevTools.
// The function resolves the current state at call time — it does not
// capture a closure at app-load. See docs/reporting-bugs.md.
window.mcpClientDiagnostics = () => snapshotBundle();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
