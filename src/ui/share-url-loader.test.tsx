import { useEffect, type ReactNode } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import { encodeShareState, type ShareState } from '../share-url/encode.ts';
import { ServersProvider, useServers } from '../state/servers.tsx';
import { SelectionProvider, useSelection } from '../state/selection.tsx';
import { ShareLinkResolverProvider } from '../state/share-link-resolver.tsx';
import { appStore } from '../state/store-instance.ts';
import { ShareUrlLoader } from './share-url-loader.tsx';

import type { ConnectionStatus } from '../state/connection.tsx';

interface ConnectionStub {
  status: ConnectionStatus;
  inventory: {
    tools: unknown[];
    prompts: unknown[];
    resources: unknown[];
    resourceTemplates: unknown[];
  };
}

/**
 * The resolver pulls from `useConnection`. Re-export the real module's
 * symbols but swap the hook for a test-controlled value that we mutate
 * from the harness. This is the smallest-surface mock: no live MCP
 * client, no real network, no flakiness.
 */
let mockConnection: ConnectionStub = {
  status: { state: 'idle' },
  inventory: { tools: [], prompts: [], resources: [], resourceTemplates: [] },
};

vi.mock('../state/connection.tsx', () => ({
  useConnection: () => mockConnection,
}));

/**
 * Probes the providers from inside the tree so assertions can read live
 * context state.
 */
interface Probe {
  servers: ReturnType<typeof useServers>;
  selection: ReturnType<typeof useSelection>;
}

function StateProbe({ onProbe }: { onProbe: (p: Probe) => void }) {
  const servers = useServers();
  const selection = useSelection();
  useEffect(() => {
    onProbe({ servers, selection });
  });
  return null;
}

function Harness({ onProbe }: { onProbe: (p: Probe) => void }): ReactNode {
  return (
    <MantineProvider>
      <Notifications />
      <ServersProvider>
        <SelectionProvider>
          <ShareLinkResolverProvider>
            <ShareUrlLoader />
            <StateProbe onProbe={onProbe} />
          </ShareLinkResolverProvider>
        </SelectionProvider>
      </ServersProvider>
    </MantineProvider>
  );
}

function setLocationHash(hash: string): void {
  window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
}

describe('ShareUrlLoader', () => {
  beforeEach(() => {
    appStore.clearAll();
    mockConnection = {
      status: { state: 'idle' },
      inventory: { tools: [], prompts: [], resources: [], resourceTemplates: [] },
    };
    window.history.replaceState(null, '', window.location.pathname);
  });

  afterEach(() => {
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('is a no-op when the hash is empty', async () => {
    setLocationHash('');
    let probe: Probe | null = null;
    render(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(probe).not.toBeNull());
    expect(probe!.servers.servers).toHaveLength(0);
    expect(probe!.selection.inbox).toBeNull();
    expect(probe!.selection.selection).toBeNull();
  });

  it('hands off to the resolver rather than silently adding the server', async () => {
    // Loader behaviour change (DEC-015 B.1 / SOW-0005 Chunk B): the
    // loader no longer creates a server entry on its own. It hands
    // off to the resolver, which raises the server-missing modal —
    // the user explicitly confirms the add. This test asserts the
    // pre-confirmation state: hash is consumed, no server has been
    // persisted yet, and the inbox stays empty until 'connecting'.
    const state: ShareState = {
      v: 1,
      url: 'https://shared.example/mcp',
      tool: 'add',
      args: { a: 2, b: 3 },
    };
    const encoded = await encodeShareState(state);
    setLocationHash(`#${encoded}`);

    let probe: Probe | null = null;
    render(<Harness onProbe={(p) => (probe = p)} />);

    // Hash is stripped after consumption so a reload does not reapply.
    await waitFor(() => {
      expect(window.location.hash).toBe('');
    });
    // No server added yet — the user has not confirmed.
    expect(probe!.servers.servers).toHaveLength(0);
    // No selection or inbox yet — the resolver only seeds the inbox
    // after the user accepts the server-missing modal AND the
    // connection settles AND the tool is in inventory.
    expect(probe!.selection.inbox).toBeNull();
    expect(probe!.selection.selection).toBeNull();
  });

  it('selects the tool once the connection is up and the inventory lists it', async () => {
    // Pre-seed the server in storage so the resolver skips the
    // server-missing modal and goes straight to 'connecting'.
    const existing = {
      id: 'pre',
      url: 'https://shared.example/mcp',
      name: 'Saved',
      transport: 'auto' as const,
      addedAt: 1,
      lastUsed: null,
    };
    appStore.write('servers', [existing]);

    const state: ShareState = {
      v: 1,
      url: 'https://shared.example/mcp',
      tool: 'add',
      args: { a: 7, b: 11 },
    };
    const encoded = await encodeShareState(state);
    setLocationHash(`#${encoded}`);

    let probe: Probe | null = null;
    const { rerender } = render(<Harness onProbe={(p) => (probe = p)} />);

    // Wait for the loader to find the existing server and dispatch.
    await waitFor(() => {
      expect(probe!.servers.activeId).toBe('pre');
    });

    // Now simulate "user clicked Connect, inventory came back".
    act(() => {
      mockConnection = {
        status: { state: 'connected' },
        inventory: {
          tools: [{ name: 'add', description: 'Add two numbers' }],
          prompts: [],
          resources: [],
          resourceTemplates: [],
        },
      };
    });
    rerender(<Harness onProbe={(p) => (probe = p)} />);

    // The resolver advances to 'loaded' and pre-fills the inbox; the
    // request panel reads the inbox to apply tool selection on its
    // own render. Assert the inbox is set with the right shape.
    await waitFor(() => {
      expect(probe!.selection.inbox).toEqual({ tool: 'add', args: { a: 7, b: 11 } });
    });
  });

  it('falls back to existing server entry when the URL matches', async () => {
    const existing = { id: 'pre', url: 'https://shared.example/mcp', name: 'Saved' };
    appStore.write('servers', [{ ...existing, transport: 'auto', addedAt: 1, lastUsed: null }]);

    const state: ShareState = { v: 1, url: 'https://shared.example/mcp' };
    const encoded = await encodeShareState(state);
    setLocationHash(`#${encoded}`);

    let probe: Probe | null = null;
    render(<Harness onProbe={(p) => (probe = p)} />);

    await waitFor(() => {
      expect(probe!.servers.activeId).toBe('pre');
    });
    expect(probe!.servers.servers).toHaveLength(1);
  });

  it('ignores invalid share fragments without throwing', async () => {
    setLocationHash('#s=%%%');
    let probe: Probe | null = null;
    render(<Harness onProbe={(p) => (probe = p)} />);
    await waitFor(() => expect(probe).not.toBeNull());
    expect(probe!.servers.servers).toHaveLength(0);
    expect(probe!.selection.inbox).toBeNull();
  });
});
