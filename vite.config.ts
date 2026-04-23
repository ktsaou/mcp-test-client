import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // Serve Vite from the repo root; the actual entry document lives in src/.
  root: 'src',

  // Static assets (public-servers.json etc.) live at the repo root so they
  // can be PR-updated separately from application code.
  publicDir: '../public',

  // Use relative paths so the built app works under any subpath.
  // GitHub Pages serves at `<user>.github.io/<repo>/`, which would break
  // absolute-rooted asset URLs. Relative asset URLs work everywhere.
  base: './',

  server: {
    port: 5173,
    strictPort: false,
  },

  build: {
    // Build artefacts go to the repo-level ./dist, not src/dist.
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
  },

  optimizeDeps: {
    // Belt-and-braces: prevent Vite from trying to pre-bundle this Node-only
    // transitive dep. We never import @modelcontextprotocol/sdk/client/stdio.js.
    exclude: ['cross-spawn'],
  },
});
