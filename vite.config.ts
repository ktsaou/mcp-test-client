import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

function readGitSha(): string {
  // Prefer the env var so CI can pin a known SHA without invoking git.
  const fromEnv = process.env.GIT_SHA ?? process.env.GITHUB_SHA;
  if (fromEnv && fromEnv.length > 0) return fromEnv.slice(0, 7);
  try {
    // execFileSync with an argv array — no shell expansion, no injection risk.
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const GIT_SHA = readGitSha();
const BUILD_TIME = new Date().toISOString();

export default defineConfig({
  plugins: [react()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(GIT_SHA),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },

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
