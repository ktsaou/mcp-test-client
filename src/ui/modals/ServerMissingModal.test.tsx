/**
 * Render shape + dispatch correctness for ServerMissingModal
 * (DEC-015 B.1 / SOW-0005 Chunk B).
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
import { ServerMissingModal } from './ServerMissingModal.tsx';

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
            <ServerMissingModal />
          </ShareLinkResolverProvider>
        </SelectionProvider>
      </ServersProvider>
    </MantineProvider>
  );
}

describe('ServerMissingModal', () => {
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

  it('renders the title, body, and both action buttons when state is server-missing', async () => {
    let api: ReturnType<typeof useShareLinkResolver> | null = null;
    render(<Harness onReady={(a) => (api = a)} />);
    await waitFor(() => expect(api).not.toBeNull());

    // Modal is hidden initially.
    expect(screen.queryByText('Add a server to open this link')).toBeNull();

    act(() => {
      api!.begin({ url: 'https://shared.example/mcp', tool: 'add' });
    });

    await screen.findByText('Add a server to open this link');
    // The shared URL appears in the body.
    expect(screen.getByText('https://shared.example/mcp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add server and continue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it("Add server and continue dispatches resolveServerMissing('add')", async () => {
    let api: ReturnType<typeof useShareLinkResolver> | null = null;
    render(<Harness onReady={(a) => (api = a)} />);
    await waitFor(() => expect(api).not.toBeNull());

    act(() => {
      api!.begin({ url: 'https://shared.example/mcp', tool: 'add' });
    });
    await screen.findByText('Add a server to open this link');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add server and continue' }));

    // Resolver advances to 'connecting' after a successful add.
    await waitFor(() => expect(api!.state.kind).toBe('connecting'));
  });

  it("Cancel dispatches resolveServerMissing('cancel')", async () => {
    let api: ReturnType<typeof useShareLinkResolver> | null = null;
    render(<Harness onReady={(a) => (api = a)} />);
    await waitFor(() => expect(api).not.toBeNull());

    act(() => {
      api!.begin({ url: 'https://shared.example/mcp' });
    });
    await screen.findByText('Add a server to open this link');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(api!.state.kind).toBe('idle'));
  });
});
