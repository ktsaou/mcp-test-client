/**
 * Minimal MCP server used by the E2E test harness.
 *
 * Exposes a handful of tools, prompts, and resources over Streamable HTTP
 * with permissive CORS so the browser app loaded from any localhost port
 * can connect.
 *
 * Session model — one MCP `Server` + transport pair per `initialize`. The
 * Playwright fixture is reused across specs (`reuseExistingServer: !CI`),
 * and the SDK rejects re-initialization on a transport that has already
 * answered an `initialize`. Maintaining a `sessionId → transport` map
 * means each Playwright spec opens its own session without stepping on
 * the previous one.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

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

function buildMcpServer(): Server {
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
    contents: [
      { uri: req.params.uri, mimeType: 'text/plain', text: 'Hello from the mock server.' },
    ],
  }));

  return mcp;
}

export async function startMockServer(port = 0): Promise<RunningServer> {
  // sessionId → transport map. A new transport is created on every
  // unsessioned `initialize`; subsequent requests carrying the
  // `MCP-Session-Id` header are routed back to the right one.
  const sessions = new Map<string, StreamableHTTPServerTransport>();
  const servers = new Set<Server>();

  async function createSession(): Promise<StreamableHTTPServerTransport> {
    const mcp = buildMcpServer();
    let assignedSessionId: string | undefined;
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => `mock-${randomUUID()}`,
      onsessioninitialized: (id) => {
        assignedSessionId = id;
        sessions.set(id, transport);
      },
      onsessionclosed: (id) => {
        sessions.delete(id);
      },
    });
    await mcp.connect(transport);
    servers.add(mcp);
    transport.onclose = () => {
      if (assignedSessionId) sessions.delete(assignedSessionId);
      void mcp.close().catch(() => undefined);
      servers.delete(mcp);
    };
    return transport;
  }

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    // Permissive CORS for any localhost origin in development + tests.
    const origin = req.headers.origin ?? '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, MCP-Session-Id, MCP-Protocol-Version, Last-Event-ID',
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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

    void routeRequest(req, res);
  });

  async function routeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const sessionId = pickHeader(req.headers, 'mcp-session-id');
    if (sessionId) {
      const transport = sessions.get(sessionId);
      if (!transport) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Session not found' },
            id: null,
          }),
        );
        return;
      }
      await transport.handleRequest(req, res);
      return;
    }

    // No session id: only `initialize` is allowed (per spec). The SDK
    // assigns a fresh id on the first POST that carries an initialize
    // payload; we hand the request to a fresh transport so each spec
    // gets its own session.
    const transport = await createSession();
    await transport.handleRequest(req, res);
  }

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
      for (const s of servers) await s.close().catch(() => undefined);
      sessions.clear();
      servers.clear();
    },
  };
}

function pickHeader(headers: IncomingMessage['headers'], name: string): string | undefined {
  const v = headers[name];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0) return v[0];
  return undefined;
}

// Standalone-executable mode: `node server.ts` starts on a random port.
if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const portEnv = process.env['MOCK_MCP_PORT'];
  const port = portEnv ? Number(portEnv) : 0;
  void startMockServer(port).then((s) => {
    console.log(`mock-mcp-server listening at ${s.url}`);
  });
}
