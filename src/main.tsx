import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { snapshotBundle } from './diagnostics/current.ts';
import './ui/theme.css';
import './ui/shell.css';
import './ui/json-view.css';
import './schema-form/schema-form.css';

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
