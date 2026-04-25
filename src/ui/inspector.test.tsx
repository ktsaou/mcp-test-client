import { describe, expect, it } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';

import { InventoryEmptyState } from './inspector.tsx';
import type { ConnectionStatus } from '../state/connection.tsx';

function render(ui: ReactNode) {
  return rtlRender(<MantineProvider>{ui}</MantineProvider>);
}

describe('InventoryEmptyState', () => {
  it('idle state asks the user to connect', () => {
    const status: ConnectionStatus = { state: 'idle' };
    render(<InventoryEmptyState status={status} />);
    expect(screen.getByText(/connect to a server to see its inventory/i)).toBeInTheDocument();
  });

  it('connecting state announces negotiation', () => {
    const status: ConnectionStatus = { state: 'connecting' };
    render(<InventoryEmptyState status={status} />);
    expect(screen.getByText(/negotiating with the server/i)).toBeInTheDocument();
  });

  it('error state surfaces the server message and does NOT lie about needing to connect', () => {
    const status: ConnectionStatus = {
      state: 'error',
      error: new Error('401 Unauthorized: bad bearer'),
    };
    render(<InventoryEmptyState status={status} />);
    // The bug we are guarding against (DEC-011 F3): on connect-error the
    // pane used to render "Connect to a server to see its inventory." which
    // is misleading because the user just tried and was rejected.
    expect(screen.queryByText(/connect to a server to see its inventory/i)).toBeNull();
    expect(screen.getByText(/server returned:/i)).toBeInTheDocument();
    expect(screen.getByText(/401 unauthorized: bad bearer/i)).toBeInTheDocument();
    expect(screen.getByText(/check the url or token/i)).toBeInTheDocument();
  });

  it('connected state renders nothing (parent handles per-tab empties)', () => {
    const status: ConnectionStatus = { state: 'connected' };
    render(<InventoryEmptyState status={status} />);
    // Crucially the connect/idle copy must NOT leak when we are connected:
    // the parent decides whether to show "Server exposed no <kind>".
    expect(screen.queryByText(/connect to a server/i)).toBeNull();
    expect(screen.queryByText(/negotiating/i)).toBeNull();
    expect(screen.queryByText(/server returned:/i)).toBeNull();
  });
});
