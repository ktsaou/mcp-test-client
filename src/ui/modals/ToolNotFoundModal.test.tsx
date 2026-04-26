/**
 * Render shape + dispatch correctness for ToolNotFoundModal
 * (DEC-015 B.3 / SOW-0005 Chunk B).
 */

import { useEffect, type ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import { SelectionProvider, useSelection } from '../../state/selection.tsx';
import { ServersProvider } from '../../state/servers.tsx';
import {
  ShareLinkResolverProvider,
  useShareLinkResolver,
} from '../../state/share-link-resolver.tsx';
import { appStore } from '../../state/store-instance.ts';
import { ToolNotFoundModal } from './ToolNotFoundModal.tsx';

import type { ConnectionStatus } from '../../state/connection.tsx';

let mockConnection: {
  status: ConnectionStatus;
  inventory: {
    tools: unknown[];
    prompts: unknown[];
    resources: unknown[];
    resourceTemplates: unknown[];
  };
} = {
  status: { state: 'idle' },
  inventory: { tools: [], prompts: [], resources: [], resourceTemplates: [] },
};
vi.mock('../../state/connection.tsx', () => ({ useConnection: () => mockConnection }));

function ResolverHandle({
  onReady,
}: {
  onReady: (api: {
    resolver: ReturnType<typeof useShareLinkResolver>;
    selection: ReturnType<typeof useSelection>;
  }) => void;
}) {
  const resolver = useShareLinkResolver();
  const selection = useSelection();
  useEffect(() => {
    onReady({ resolver, selection });
  });
  return null;
}

function Harness({
  onReady,
}: {
  onReady: (api: {
    resolver: ReturnType<typeof useShareLinkResolver>;
    selection: ReturnType<typeof useSelection>;
  }) => void;
}): ReactNode {
  return (
    <MantineProvider>
      <Notifications />
      <ServersProvider>
        <SelectionProvider>
          <ShareLinkResolverProvider>
            <ResolverHandle onReady={onReady} />
            <ToolNotFoundModal />
          </ShareLinkResolverProvider>
        </SelectionProvider>
      </ServersProvider>
    </MantineProvider>
  );
}

async function driveToToolNotFound(
  getBag: () => { resolver: ReturnType<typeof useShareLinkResolver> },
  rerender: () => void,
) {
  act(() => {
    getBag().resolver.begin({
      url: 'https://shared.example/mcp',
      tool: 'gone',
      args: { x: 9 },
    });
  });
  await waitFor(() => expect(getBag().resolver.state.kind).toBe('server-missing'));
  act(() => {
    getBag().resolver.resolveServerMissing('add');
  });
  await waitFor(() => expect(getBag().resolver.state.kind).toBe('connecting'));

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
  rerender();
  await waitFor(() => expect(getBag().resolver.state.kind).toBe('tool-not-found'));
}

describe('ToolNotFoundModal', () => {
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

  it('renders title, body with tool name + url, and both action buttons', async () => {
    let bag: {
      resolver: ReturnType<typeof useShareLinkResolver>;
      selection: ReturnType<typeof useSelection>;
    } | null = null;
    const { rerender } = render(<Harness onReady={(b) => (bag = b)} />);
    await waitFor(() => expect(bag).not.toBeNull());
    await driveToToolNotFound(
      () => bag!,
      () => rerender(<Harness onReady={(b) => (bag = b)} />),
    );

    expect(screen.getByText('Tool not found on this server')).toBeInTheDocument();
    expect(screen.getByText('gone')).toBeInTheDocument();
    expect(screen.getByText('https://shared.example/mcp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open as raw JSON-RPC anyway' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it("Open as raw JSON-RPC anyway dispatches resolveToolNotFound('open-raw') and seeds the inbox with the envelope", async () => {
    let bag: {
      resolver: ReturnType<typeof useShareLinkResolver>;
      selection: ReturnType<typeof useSelection>;
    } | null = null;
    const { rerender } = render(<Harness onReady={(b) => (bag = b)} />);
    await waitFor(() => expect(bag).not.toBeNull());
    await driveToToolNotFound(
      () => bag!,
      () => rerender(<Harness onReady={(b) => (bag = b)} />),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open as raw JSON-RPC anyway' }));

    await waitFor(() => expect(bag!.resolver.state.kind).toBe('loaded'));
    const raw = bag!.selection.inbox?.raw;
    expect(typeof raw).toBe('string');
    const parsed = JSON.parse(raw as string) as Record<string, unknown>;
    expect(parsed['method']).toBe('tools/call');
    expect((parsed['params'] as Record<string, unknown>)['name']).toBe('gone');
    expect((parsed['params'] as Record<string, unknown>)['arguments']).toEqual({ x: 9 });
  });

  it("Cancel dispatches resolveToolNotFound('cancel'); inbox stays empty", async () => {
    let bag: {
      resolver: ReturnType<typeof useShareLinkResolver>;
      selection: ReturnType<typeof useSelection>;
    } | null = null;
    const { rerender } = render(<Harness onReady={(b) => (bag = b)} />);
    await waitFor(() => expect(bag).not.toBeNull());
    await driveToToolNotFound(
      () => bag!,
      () => rerender(<Harness onReady={(b) => (bag = b)} />),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(bag!.resolver.state.kind).toBe('idle'));
    expect(bag!.selection.inbox).toBeNull();
  });
});
