/**
 * Minimal MCP server used by the E2E test harness.
 *
 * Exposes a handful of tools, prompts, and resources over Streamable HTTP
 * with permissive CORS so the browser app loaded from any localhost port
 * can connect.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export interface RunningServer {
  url: string;
  close: () => Promise<void>;
}

export async function startMockServer(port = 0): Promise<RunningServer> {
  const mcp = new Server(
    { name: 'mock-mcp-server', version: '0.0.1' },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    },
  );

  mcp.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [
      {
        name: 'echo',
        description: 'Return the input text verbatim.',
        inputSchema: {
          type: 'object',
          properties: { text: { type: 'string', description: 'Text to echo' } },
          required: ['text'],
        },
      },
      {
        name: 'add',
        description: 'Add two numbers.',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number' },
            b: { type: 'number' },
          },
          required: ['a', 'b'],
        },
      },
    ],
  }));

  mcp.setRequestHandler(CallToolRequestSchema, (req) => {
    const { name, arguments: args } = req.params;
    if (name === 'echo') {
      const text = typeof args?.text === 'string' ? args.text : '';
      return { content: [{ type: 'text', text }] };
    }
    if (name === 'add') {
      const a = Number(args?.a ?? 0);
      const b = Number(args?.b ?? 0);
      return { content: [{ type: 'text', text: String(a + b) }] };
    }
    return { content: [{ type: 'text', text: `unknown tool ${name}` }], isError: true };
  });

  mcp.setRequestHandler(ListPromptsRequestSchema, () => ({
    prompts: [
      {
        name: 'greet',
        description: 'Greet someone by name.',
        arguments: [{ name: 'who', description: 'Name', required: true }],
      },
    ],
  }));

  mcp.setRequestHandler(GetPromptRequestSchema, (req) => ({
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: `Hello, ${String(req.params.arguments?.who ?? 'world')}!` },
      },
    ],
  }));

  mcp.setRequestHandler(ListResourcesRequestSchema, () => ({
    resources: [{ uri: 'memo://hello', name: 'hello', description: 'A tiny in-memory memo' }],
  }));

  mcp.setRequestHandler(ReadResourceRequestSchema, (req) => ({
    contents: [{ uri: req.params.uri, mimeType: 'text/plain', text: 'Hello from the mock server.' }],
  }));

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => `mock-${Date.now()}`,
  });
  await mcp.connect(transport);

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    // Permissive CORS for any localhost origin in development + tests.
    const origin = req.headers.origin ?? '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, MCP-Session-Id, MCP-Protocol-Version, Last-Event-ID',
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, DELETE, OPTIONS',
    );
    res.setHeader('Access-Control-Expose-Headers', 'MCP-Session-Id, MCP-Protocol-Version');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    // Tiny health endpoint Playwright's webServer can hit; bypasses MCP.
    if (req.url === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end('ok');
      return;
    }

    void transport.handleRequest(req, res);
  });

  await new Promise<void>((resolve) => http.listen(port, '127.0.0.1', resolve));
  const addr = http.address();
  if (!addr || typeof addr === 'string') throw new Error('server did not get an address');
  const url = `http://127.0.0.1:${addr.port}/mcp`;

  return {
    url,
    close: async () => {
      await new Promise<void>((resolve, reject) =>
        http.close((err) => (err ? reject(err) : resolve())),
      );
      await mcp.close().catch(() => undefined);
    },
  };
}

// Standalone-executable mode: `node server.ts` starts on a random port.
if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const portEnv = process.env['MOCK_MCP_PORT'];
  const port = portEnv ? Number(portEnv) : 0;
  startMockServer(port).then((s) => {
    // eslint-disable-next-line no-console
    console.log(`mock-mcp-server listening at ${s.url}`);
  });
}
