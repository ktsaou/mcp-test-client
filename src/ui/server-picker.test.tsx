/**
 * DEC-033 / SOW-0006 — persistent help block under the credential
 * field when a known auth-required server is picked from the dropdown.
 * Asserts:
 *   1. block is hidden until a known server is picked
 *   2. picking a server with `instructions` + `instructions_url` shows
 *      both the text and a link
 *   3. typing a token clears the inline empty-field error but the help
 *      block STAYS (acceptance criterion 3 + 4)
 *   4. editing the URL away from the catalog entry's URL clears the
 *      help block (the picked-id is dropped)
 *   5. picking a known server with neither `instructions` nor
 *      `instructions_url` does NOT render the help block / Alert
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import type { ReactNode } from 'react';

import type { CatalogServer } from '../catalog/types.ts';

// Mock the catalog loader BEFORE importing ServerPicker so the modal
// receives a deterministic in-memory catalog. Two entries: one with
// `instructions` + `instructions_url`, one with neither.
const fakeCatalog: { version: 1; servers: CatalogServer[] } = {
  version: 1,
  servers: [
    {
      id: 'netdata-cloud',
      name: 'Netdata Cloud',
      url: 'https://app.netdata.cloud/api/v1/mcp',
      transport: 'streamable-http',
      description: 'Test fixture for the auth-required help-block.',
      auth: 'bearer',
      instructions: 'Create an API token with scope:mcp at app.netdata.cloud → Profile.',
      instructions_url: 'https://docs.netdata.cloud/auth-tokens',
      addedAt: '2026-04-28',
      status: 'active',
    },
    {
      id: 'cloudflare-mcp',
      name: 'Cloudflare API',
      url: 'https://mcp.cloudflare.com/mcp',
      transport: 'streamable-http',
      description: 'Auth-required entry without any help text.',
      auth: 'oauth',
      addedAt: '2026-04-25',
      status: 'active',
    },
  ],
};

vi.mock('../catalog/loader.ts', () => ({
  loadCatalog: () => Promise.resolve(fakeCatalog),
}));

import { ServerPicker } from './server-picker.tsx';
import { ConnectionProvider } from '../state/connection.tsx';
import { LogProvider } from '../state/log.tsx';
import { ServersProvider } from '../state/servers.tsx';
import { __setStorageForTests } from '../state/store-instance.ts';
import { MemoryStorage } from '../persistence/store.test.ts';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <ModalsProvider>
        <Notifications />
        <ServersProvider>
          <LogProvider>
            <ConnectionProvider>{children}</ConnectionProvider>
          </LogProvider>
        </ServersProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}

beforeEach(() => {
  __setStorageForTests(new MemoryStorage());
});

async function openAddModal(): Promise<HTMLElement> {
  render(
    <Wrapper>
      <ServerPicker />
    </Wrapper>,
  );
  // The header "Add" button opens the modal in add mode.
  fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));
  // The modal title confirms the modal mounted.
  return await screen.findByRole('dialog');
}

async function pickKnownServer(modal: HTMLElement, label: string): Promise<void> {
  // Mantine Select: click the input to open, then click the option.
  const input = await within(modal).findByPlaceholderText('Choose…');
  fireEvent.click(input);
  // The option list portals to document.body.
  const option = await screen.findByRole('option', { name: label });
  fireEvent.click(option);
}

describe('ServerPicker — DEC-033 catalog instructions help block', () => {
  it('does not render the help block before any known server is picked', async () => {
    const modal = await openAddModal();
    // Wait until the catalog dropdown shows up — async load resolves.
    await within(modal).findByPlaceholderText('Choose…');
    expect(within(modal).queryByText(/Where to find this/i)).toBeNull();
    expect(within(modal).queryByText(/scope:mcp/i)).toBeNull();
  });

  it('shows instructions text and link after picking Netdata Cloud', async () => {
    const modal = await openAddModal();
    await pickKnownServer(modal, 'Netdata Cloud');
    await waitFor(() => {
      expect(within(modal).getByText(/scope:mcp at app\.netdata\.cloud/i)).toBeInTheDocument();
    });
    const link = within(modal).getByRole('link', { name: /Where to find this/i });
    expect(link).toHaveAttribute('href', 'https://docs.netdata.cloud/auth-tokens');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('keeps the help block visible while the user types a token (criterion 3 + 4)', async () => {
    const modal = await openAddModal();
    await pickKnownServer(modal, 'Netdata Cloud');
    // Inline empty-field error is present before the user types.
    await within(modal).findByText(/scope:mcp/i);
    expect(within(modal).getByText(/Token required/i)).toBeInTheDocument();

    // Type a token into the bearer-token input. Mantine renders the
    // label "Bearer token" but the error gets attached via `error` prop.
    // Find the password input by its label.
    const tokenInput = within(modal).getByLabelText(/Bearer token/i);
    fireEvent.change(tokenInput, { target: { value: 'pasted-token-value' } });

    await waitFor(() => {
      expect(within(modal).queryByText(/Token required/i)).toBeNull();
    });
    // Help block survived — instructions text + link still rendered.
    expect(within(modal).getByText(/scope:mcp/i)).toBeInTheDocument();
    expect(within(modal).getByRole('link', { name: /Where to find this/i })).toBeInTheDocument();
  });

  it('clears the help block when the user diverges from the catalog URL', async () => {
    const modal = await openAddModal();
    await pickKnownServer(modal, 'Netdata Cloud');
    await within(modal).findByText(/scope:mcp/i);

    // The URL field is required; find it by label (Mantine appends ` *`
    // to required field labels but getByLabelText handles that).
    const urlInput = within(modal).getByLabelText(/^URL/i);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/different/mcp' } });

    await waitFor(() => {
      expect(within(modal).queryByText(/scope:mcp/i)).toBeNull();
    });
    expect(within(modal).queryByRole('link', { name: /Where to find this/i })).toBeNull();
  });

  it('does not render the help block for a known server without instructions', async () => {
    const modal = await openAddModal();
    await pickKnownServer(modal, 'Cloudflare API');
    // Confirm the dropdown DID act on the pick — the URL field reflects
    // the catalog entry's URL.
    const urlInput = within(modal).getByLabelText(/^URL/i) as HTMLInputElement;
    await waitFor(() => {
      expect(urlInput.value).toBe('https://mcp.cloudflare.com/mcp');
    });
    // No help block / link should render — the Cloudflare fixture
    // entry has neither instructions nor instructions_url.
    expect(within(modal).queryByRole('link', { name: /Where to find this/i })).toBeNull();
    expect(within(modal).queryByText(/scope:mcp/i)).toBeNull();
  });
});
