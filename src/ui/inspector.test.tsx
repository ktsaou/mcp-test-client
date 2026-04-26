import { describe, expect, it } from 'vitest';
import { render as rtlRender, screen, fireEvent, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';

import { Inspector, InventoryEmptyState } from './inspector.tsx';
import {
  ConnectionContext,
  type ConnectionContextValue,
  type ConnectionStatus,
} from '../state/connection.tsx';
import { SelectionProvider } from '../state/selection.tsx';

function render(ui: ReactNode) {
  return rtlRender(<MantineProvider>{ui}</MantineProvider>);
}

function withConnection(
  inventory: Partial<ConnectionContextValue['inventory']>,
  ui: ReactNode,
  status: ConnectionStatus = { state: 'connected' },
): ReactNode {
  const value: ConnectionContextValue = {
    status,
    inventory: {
      tools: [],
      prompts: [],
      resources: [],
      resourceTemplates: [],
      errors: {},
      ...inventory,
    },
    client: null,
    connect: async () => 'connected' as const,
    disconnect: async () => undefined,
  };
  return (
    <MantineProvider>
      <ConnectionContext.Provider value={value}>
        <SelectionProvider>{ui}</SelectionProvider>
      </ConnectionContext.Provider>
    </MantineProvider>
  );
}

describe('Inspector list — sorting and search', () => {
  it('renders tools alphabetically regardless of server order', () => {
    const tools = [
      { name: 'zai_vision-analyze_image', description: 'fallback' },
      { name: 'brave-brave_web_search', description: 'web search' },
      { name: 'context7-resolve-library-id', description: 'resolve a library id' },
      { name: 'jina-read_url', description: 'extract page content' },
    ];
    rtlRender(withConnection({ tools }, <Inspector />));
    const expected = [
      'brave-brave_web_search',
      'context7-resolve-library-id',
      'jina-read_url',
      'zai_vision-analyze_image',
    ];
    const positions = expected.map((name) => {
      const node = screen.getByText(name);
      // Position in document order — getBoundingClientRect.top is consistent
      // for a list rendered top-to-bottom in JSDOM.
      return node.getBoundingClientRect().top;
    });
    // Each name's position must be greater than (or equal to, in JSDOM
    // where layout is degenerate) the previous one — ascending in DOM
    // order.
    for (let i = 1; i < positions.length; i++) {
      const prevNode = screen.getByText(expected[i - 1]!);
      const currNode = screen.getByText(expected[i]!);
      // compareDocumentPosition is the unambiguous DOM-order check that
      // doesn't depend on JSDOM layout.
      // 4 = DOCUMENT_POSITION_FOLLOWING
      expect(prevNode.compareDocumentPosition(currNode) & 4).toBe(4);
    }
  });

  it('filters by name (case-insensitive substring)', () => {
    const tools = [
      { name: 'brave-brave_image_search', description: 'image search' },
      { name: 'brave-brave_web_search', description: 'web search' },
      { name: 'jina-read_url', description: 'extract page content' },
    ];
    rtlRender(withConnection({ tools }, <Inspector />));
    const search = screen.getByLabelText(/search tools/i) as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'brave' } });
    expect(screen.getByText('brave-brave_image_search')).toBeInTheDocument();
    expect(screen.getByText('brave-brave_web_search')).toBeInTheDocument();
    expect(screen.queryByText('jina-read_url')).toBeNull();
  });

  it('filters by description as well as name', () => {
    const tools = [
      { name: 'tool-a', description: 'searches the web' },
      { name: 'tool-b', description: 'reads a file' },
    ];
    rtlRender(withConnection({ tools }, <Inspector />));
    const search = screen.getByLabelText(/search tools/i) as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'web' } });
    // Description-match keeps tool-a even though name doesn't contain 'web'
    expect(screen.getByText('tool-a')).toBeInTheDocument();
    expect(screen.queryByText('tool-b')).toBeNull();
  });

  it('shows a "no matches" empty state when the query filters everything out', () => {
    const tools = [{ name: 'one', description: 'first' }];
    rtlRender(withConnection({ tools }, <Inspector />));
    const search = screen.getByLabelText(/search tools/i) as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'nonexistent' } });
    expect(screen.getByText(/no tools match "nonexistent"/i)).toBeInTheDocument();
    expect(screen.queryByText('one')).toBeNull();
  });

  it('hides the search box when the active tab is empty', () => {
    rtlRender(withConnection({ tools: [] }, <Inspector />));
    expect(screen.queryByLabelText(/search tools/i)).toBeNull();
    // DEC-028: empty inventory tab renders the new EmptyState copy
    // with a spec link, replacing the v1.2.2 "Server exposed no
    // tools." short form.
    expect(screen.getByText(/this server doesn't expose any tools\./i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /what is a tool\?/i })).toBeInTheDocument();
  });

  it('renders a red Alert (not EmptyState) when the list call errored', () => {
    rtlRender(
      withConnection(
        {
          tools: [],
          errors: { tools: 'tools/list unavailable: MCP error -32601: Method not found' },
        },
        <Inspector />,
      ),
    );
    // DEC-028 anti-case: a 32601 on tools/list is an error, not "this
    // server has zero tools" — the Alert must surface the "List
    // unavailable" title plus the underlying message, and the empty-
    // state copy must NOT appear.
    expect(screen.getAllByText(/list unavailable/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/method not found/i)).toBeInTheDocument();
    expect(screen.queryByText(/this server doesn't expose any tools\./i)).toBeNull();
  });

  it('tab counts reflect the full inventory, not the filtered subset', () => {
    const tools = [
      { name: 'brave-x', description: 'a' },
      { name: 'brave-y', description: 'b' },
      { name: 'jina-z', description: 'c' },
    ];
    rtlRender(withConnection({ tools }, <Inspector />));
    const toolsTab = screen.getByRole('tab', { name: /tools/i });
    expect(within(toolsTab).getByText('3')).toBeInTheDocument();
    const search = screen.getByLabelText(/search tools/i) as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'brave' } });
    // The badge count remains 3 even though only 2 entries are visible.
    // This lets the user see at a glance whether other tabs would have
    // matches without switching.
    expect(within(toolsTab).getByText('3')).toBeInTheDocument();
  });
});

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
    // is misleading because the user just tried and was rejected. DEC-028
    // moved this to a red Alert (error != empty); the message must still
    // surface, plus the URL/token hint.
    expect(screen.queryByText(/connect to a server to see its inventory/i)).toBeNull();
    expect(screen.getByText(/server returned an error/i)).toBeInTheDocument();
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
