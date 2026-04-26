/**
 * Render shape + dispatch correctness for ConnectionFailedModal
 * (DEC-015 B.2 / SOW-0005 Chunk B).
 */

import { useEffect, type ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import { SelectionProvider } from '../../state/selection.tsx';
import { ServersProvider } from '../../state/servers.tsx';
import {
  ShareLinkResolverProvider,
  useShareLinkResolver,
} from '../../state/share-link-resolver.tsx';
import { appStore } from '../../state/store-instance.ts';
import { ConnectionFailedModal } from './ConnectionFailedModal.tsx';

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
  onReady: (api: ReturnType<typeof useShareLinkResolver>) => void;
}) {
  const api = useShareLinkResolver();
  useEffect(() => {
    onReady(api);
  });
  return null;
}

function Harness({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useShareLinkResolver>) => void;
}): ReactNode {
  return (
    <MantineProvider>
      <Notifications />
      <ServersProvider>
        <SelectionProvider>
          <ShareLinkResolverProvider>
            <ResolverHandle onReady={onReady} />
            <ConnectionFailedModal />
          </ShareLinkResolverProvider>
        </SelectionProvider>
      </ServersProvider>
    </MantineProvider>
  );
}

async function driveToConnectionError(getApi: () => ReturnType<typeof useShareLinkResolver>) {
  act(() => {
    getApi().begin({ url: 'https://shared.example/mcp', tool: 'add' });
  });
  await waitFor(() => expect(getApi().state.kind).toBe('server-missing'));
  act(() => {
    getApi().resolveServerMissing('add');
  });
  await waitFor(() => expect(getApi().state.kind).toBe('connecting'));
}

describe('ConnectionFailedModal', () => {
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

  it('renders title, error message, and both action buttons', async () => {
    let api: ReturnType<typeof useShareLinkResolver> | null = null;
    const { rerender } = render(<Harness onReady={(a) => (api = a)} />);
    await waitFor(() => expect(api).not.toBeNull());
    await driveToConnectionError(() => api!);

    act(() => {
      mockConnection = {
        status: { state: 'error', error: new Error('refused: bad token') },
        inventory: { tools: [], prompts: [], resources: [], resourceTemplates: [] },
      };
    });
    rerender(<Harness onReady={(a) => (api = a)} />);

    await screen.findByText('Connection failed');
    expect(screen.getByText('refused: bad token')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open server settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it("Open server settings dispatches resolveConnectionError('open-settings')", async () => {
    let api: ReturnType<typeof useShareLinkResolver> | null = null;
    const { rerender } = render(<Harness onReady={(a) => (api = a)} />);
    await waitFor(() => expect(api).not.toBeNull());
    await driveToConnectionError(() => api!);

    act(() => {
      mockConnection = {
        status: { state: 'error', error: new Error('boom') },
        inventory: { tools: [], prompts: [], resources: [], resourceTemplates: [] },
      };
    });
    rerender(<Harness onReady={(a) => (api = a)} />);
    await screen.findByText('Connection failed');

    const events: Event[] = [];
    const handler = (e: Event) => events.push(e);
    window.addEventListener('mcptc:command-palette', handler);
    try {
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Open server settings' }));
      // Resolver drops back to 'connecting' so it can re-evaluate
      // when the user clicks Connect.
      await waitFor(() => expect(api!.state.kind).toBe('connecting'));
      // It also dispatches the edit-server custom event.
      const edit = events.find(
        (e) => (e as CustomEvent<{ type?: string }>).detail?.type === 'edit-server',
      );
      expect(edit).toBeDefined();
    } finally {
      window.removeEventListener('mcptc:command-palette', handler);
    }
  });

  it("Cancel dispatches resolveConnectionError('cancel')", async () => {
    let api: ReturnType<typeof useShareLinkResolver> | null = null;
    const { rerender } = render(<Harness onReady={(a) => (api = a)} />);
    await waitFor(() => expect(api).not.toBeNull());
    await driveToConnectionError(() => api!);

    act(() => {
      mockConnection = {
        status: { state: 'error', error: new Error('boom') },
        inventory: { tools: [], prompts: [], resources: [], resourceTemplates: [] },
      };
    });
    rerender(<Harness onReady={(a) => (api = a)} />);
    await screen.findByText('Connection failed');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(api!.state.kind).toBe('idle'));
  });
});
