/**
 * Unit tests for the share-link resolver state machine (DEC-015 Part B,
 * SOW-0005 Chunk B). Walks every transition in the machine using the
 * mocked connection hook so we never touch a real MCP client.
 */

import { useEffect, type ReactNode } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ServersProvider, useServers } from './servers.tsx';
import { SelectionProvider, useSelection } from './selection.tsx';
import {
  ShareLinkResolverProvider,
  useShareLinkResolver,
  type ResolverState,
} from './share-link-resolver.tsx';
import { appStore } from './store-instance.ts';

import type { ConnectionStatus } from './connection.tsx';

interface ConnectionStub {
  status: ConnectionStatus;
  inventory: {
    tools: unknown[];
    prompts: unknown[];
    resources: unknown[];
    resourceTemplates: unknown[];
  };
}

let mockConnection: ConnectionStub = {
  status: { state: 'idle' },
  inventory: { tools: [], prompts: [], resources: [], resourceTemplates: [] },
};

vi.mock('./connection.tsx', () => ({
  useConnection: () => mockConnection,
}));

interface Probe {
  resolver: ReturnType<typeof useShareLinkResolver>;
  servers: ReturnType<typeof useServers>;
  selection: ReturnType<typeof useSelection>;
}

function StateProbe({ onProbe }: { onProbe: (p: Probe) => void }) {
  const resolver = useShareLinkResolver();
  const servers = useServers();
  const selection = useSelection();
  useEffect(() => {
    onProbe({ resolver, servers, selection });
  });
  return null;
}

function Harness({ onProbe }: { onProbe: (p: Probe) => void }): ReactNode {
  return (
    <ServersProvider>
      <SelectionProvider>
        <ShareLinkResolverProvider>
          <StateProbe onProbe={onProbe} />
        </ShareLinkResolverProvider>
      </SelectionProvider>
    </ServersProvider>
  );
}

function lastState(probe: Probe | null): ResolverState | null {
  return probe?.resolver.state ?? null;
}

describe('ShareLinkResolver state machine', () => {
  beforeEach(() => {
    appStore.clearAll();
    mockConnection = {
      status: { state: 'idle' },
      inventory: { tools: [], prompts: [], resources: [], resourceTemplates: [] },
    };
  });

  afterEach(() => {
    appStore.clearAll();
  });

  it('idle → server-missing on begin() with an unknown URL', async () => {
    let probe: Probe | null = null;
    render(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(probe).not.toBeNull());

    expect(lastState(probe)?.kind).toBe('idle');

    act(() => {
      probe!.resolver.begin({ url: 'https://shared.example/mcp', tool: 'add', args: { a: 1 } });
    });

    await waitFor(() => expect(lastState(probe)?.kind).toBe('server-missing'));
    const state = lastState(probe);
    if (state?.kind === 'server-missing') {
      expect(state.url).toBe('https://shared.example/mcp');
      expect(state.tool).toBe('add');
      expect(state.args).toEqual({ a: 1 });
    } else {
      throw new Error('expected server-missing');
    }
  });

  it("server-missing → connecting on resolveServerMissing('add'); persists the server and sets it active", async () => {
    let probe: Probe | null = null;
    render(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(probe).not.toBeNull());

    act(() => {
      probe!.resolver.begin({ url: 'https://shared.example/mcp', tool: 'echo' });
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('server-missing'));

    act(() => {
      probe!.resolver.resolveServerMissing('add');
    });

    await waitFor(() => expect(lastState(probe)?.kind).toBe('connecting'));
    expect(probe!.servers.servers).toHaveLength(1);
    expect(probe!.servers.servers[0]!.url).toBe('https://shared.example/mcp');
    expect(probe!.servers.activeId).toBe(probe!.servers.servers[0]!.id);
  });

  it("server-missing → idle on resolveServerMissing('cancel'); no server added", async () => {
    let probe: Probe | null = null;
    render(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(probe).not.toBeNull());

    act(() => {
      probe!.resolver.begin({ url: 'https://shared.example/mcp' });
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('server-missing'));

    act(() => {
      probe!.resolver.resolveServerMissing('cancel');
    });

    await waitFor(() => expect(lastState(probe)?.kind).toBe('idle'));
    expect(probe!.servers.servers).toHaveLength(0);
  });

  it('connecting → connection-error when status flips to error', async () => {
    let probe: Probe | null = null;
    const { rerender } = render(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(probe).not.toBeNull());

    act(() => {
      probe!.resolver.begin({ url: 'https://shared.example/mcp', tool: 'add' });
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('server-missing'));
    act(() => {
      probe!.resolver.resolveServerMissing('add');
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('connecting'));

    act(() => {
      mockConnection = {
        status: { state: 'error', error: new Error('boom') },
        inventory: { tools: [], prompts: [], resources: [], resourceTemplates: [] },
      };
    });
    rerender(<Harness onProbe={(p) => (probe = p)} />);

    await waitFor(() => expect(lastState(probe)?.kind).toBe('connection-error'));
    const state = lastState(probe);
    if (state?.kind === 'connection-error') {
      expect(state.error.message).toBe('boom');
    } else {
      throw new Error('expected connection-error');
    }
  });

  it('connecting → tool-not-found when connected and inventory does not list the tool', async () => {
    let probe: Probe | null = null;
    const { rerender } = render(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(probe).not.toBeNull());

    act(() => {
      probe!.resolver.begin({ url: 'https://shared.example/mcp', tool: 'missing-tool' });
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('server-missing'));
    act(() => {
      probe!.resolver.resolveServerMissing('add');
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('connecting'));

    act(() => {
      mockConnection = {
        status: { state: 'connected' },
        inventory: {
          tools: [{ name: 'echo' }, { name: 'add' }],
          prompts: [],
          resources: [],
          resourceTemplates: [],
        },
      };
    });
    rerender(<Harness onProbe={(p) => (probe = p)} />);

    await waitFor(() => expect(lastState(probe)?.kind).toBe('tool-not-found'));
    const state = lastState(probe);
    if (state?.kind === 'tool-not-found') {
      expect(state.tool).toBe('missing-tool');
      expect(state.url).toBe('https://shared.example/mcp');
    } else {
      throw new Error('expected tool-not-found');
    }
  });

  it('connecting → loaded when connected and inventory lists the tool; inbox seeded', async () => {
    let probe: Probe | null = null;
    const { rerender } = render(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(probe).not.toBeNull());

    act(() => {
      probe!.resolver.begin({
        url: 'https://shared.example/mcp',
        tool: 'add',
        args: { a: 2, b: 3 },
      });
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('server-missing'));
    act(() => {
      probe!.resolver.resolveServerMissing('add');
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('connecting'));

    act(() => {
      mockConnection = {
        status: { state: 'connected' },
        inventory: {
          tools: [{ name: 'add' }],
          prompts: [],
          resources: [],
          resourceTemplates: [],
        },
      };
    });
    rerender(<Harness onProbe={(p) => (probe = p)} />);

    await waitFor(() => expect(lastState(probe)?.kind).toBe('loaded'));
    expect(probe!.selection.inbox).toEqual({ tool: 'add', args: { a: 2, b: 3 } });
  });

  it("connection-error → idle on resolveConnectionError('cancel')", async () => {
    let probe: Probe | null = null;
    const { rerender } = render(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(probe).not.toBeNull());

    act(() => {
      probe!.resolver.begin({ url: 'https://shared.example/mcp', tool: 'add' });
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('server-missing'));
    act(() => {
      probe!.resolver.resolveServerMissing('add');
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('connecting'));

    act(() => {
      mockConnection = {
        status: { state: 'error', error: new Error('nope') },
        inventory: { tools: [], prompts: [], resources: [], resourceTemplates: [] },
      };
    });
    rerender(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(lastState(probe)?.kind).toBe('connection-error'));

    act(() => {
      probe!.resolver.resolveConnectionError('cancel');
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('idle'));
  });

  it("tool-not-found → loaded on resolveToolNotFound('open-raw'); raw envelope written to inbox", async () => {
    let probe: Probe | null = null;
    const { rerender } = render(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(probe).not.toBeNull());

    act(() => {
      probe!.resolver.begin({
        url: 'https://shared.example/mcp',
        tool: 'gone',
        args: { x: 9 },
      });
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('server-missing'));
    act(() => {
      probe!.resolver.resolveServerMissing('add');
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('connecting'));

    act(() => {
      mockConnection = {
        status: { state: 'connected' },
        inventory: {
          tools: [{ name: 'echo' }],
          prompts: [],
          resources: [],
          resourceTemplates: [],
        },
      };
    });
    rerender(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(lastState(probe)?.kind).toBe('tool-not-found'));

    act(() => {
      probe!.resolver.resolveToolNotFound('open-raw');
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('loaded'));

    expect(probe!.selection.inbox).not.toBeNull();
    const raw = probe!.selection.inbox?.raw;
    expect(typeof raw).toBe('string');
    const parsed = JSON.parse(raw as string) as Record<string, unknown>;
    expect(parsed['jsonrpc']).toBe('2.0');
    expect(parsed['method']).toBe('tools/call');
    expect((parsed['params'] as Record<string, unknown>)['name']).toBe('gone');
    expect((parsed['params'] as Record<string, unknown>)['arguments']).toEqual({ x: 9 });
  });

  it("tool-not-found → idle on resolveToolNotFound('cancel'); inbox stays empty", async () => {
    let probe: Probe | null = null;
    const { rerender } = render(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(probe).not.toBeNull());

    act(() => {
      probe!.resolver.begin({ url: 'https://shared.example/mcp', tool: 'gone' });
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('server-missing'));
    act(() => {
      probe!.resolver.resolveServerMissing('add');
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('connecting'));

    act(() => {
      mockConnection = {
        status: { state: 'connected' },
        inventory: {
          tools: [{ name: 'echo' }],
          prompts: [],
          resources: [],
          resourceTemplates: [],
        },
      };
    });
    rerender(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(lastState(probe)?.kind).toBe('tool-not-found'));

    act(() => {
      probe!.resolver.resolveToolNotFound('cancel');
    });
    await waitFor(() => expect(lastState(probe)?.kind).toBe('idle'));
    expect(probe!.selection.inbox).toBeNull();
  });
});
