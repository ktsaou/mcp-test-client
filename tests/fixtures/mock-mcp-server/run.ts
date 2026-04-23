#!/usr/bin/env -S node --experimental-strip-types
/**
 * Standalone-run entry point for the mock MCP server. Used by Playwright's
 * webServer config. Reads MOCK_MCP_PORT from the env (default 4321).
 */

import { startMockServer } from './server.ts';

const port = Number(process.env['MOCK_MCP_PORT'] ?? 4321);

startMockServer(port)
  .then((s) => {
    console.log(`mock-mcp-server listening at ${s.url}`);
  })
  .catch((err: unknown) => {
    console.error('mock-mcp-server failed to start:', err);
    process.exit(1);
  });
