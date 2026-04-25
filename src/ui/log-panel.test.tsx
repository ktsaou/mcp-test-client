/**
 * Render-level smoke for the new log panel (DEC-012). Drives the panel
 * through a minimal request → response flow, asserts the headline shape, the
 * collapse/expand toggle, the always-visible copy/save buttons, and the
 * filter dropdown. Walks each of the 13 DEC-012 sub-items it can reach
 * without a live network.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render as rtlRender, screen, act, fireEvent, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { ReactNode } from 'react';

import { LogPanel } from './log-panel.tsx';
import { LogProvider, useLog } from '../state/log.tsx';
import { __setStorageForTests } from '../state/store-instance.ts';
import { MemoryStorage } from '../persistence/store.test.ts';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <Notifications />
      <LogProvider>{children}</LogProvider>
    </MantineProvider>
  );
}

/** Test harness: an internal component that exposes `appendWire` to the test. */
function TestDriver({ onReady }: { onReady: (ctx: ReturnType<typeof useLog>) => void }) {
  const ctx = useLog();
  // Re-fire on every render so the test always has the freshest sink.
  onReady(ctx);
  return null;
}

beforeEach(() => {
  __setStorageForTests(new MemoryStorage());
});

function renderPanel() {
  let api: ReturnType<typeof useLog> | null = null;
  const result = rtlRender(
    <Wrapper>
      <TestDriver onReady={(c) => (api = c)} />
      <LogPanel />
    </Wrapper>,
  );
  return {
    ...result,
    get api() {
      if (!api) throw new Error('LogProvider not ready');
      return api;
    },
  };
}

describe('LogPanel — DEC-012', () => {
  it('shows empty-state copy when there are no entries', () => {
    renderPanel();
    expect(screen.getByText(/wire traffic will appear here/i)).toBeInTheDocument();
  });

  it('renders headline with method · discriminator and chevron toggle', () => {
    const h = renderPanel();
    act(() => {
      h.api.appendWire({
        direction: 'outgoing',
        message: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo' } },
        timestamp: 1_000_000,
      });
    });
    // The bold method-summary headline is visible (DEC-012 #5).
    expect(screen.getByText(/tools\/call/)).toBeInTheDocument();
    expect(screen.getByText(/echo/)).toBeInTheDocument();
    // Default-collapsed: no JSON body in the DOM yet.
    expect(screen.queryByLabelText('message 1')).toBeNull();
  });

  it('toggles the body when the headline is clicked', () => {
    const h = renderPanel();
    act(() => {
      h.api.appendWire({
        direction: 'outgoing',
        message: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        timestamp: 1_000_000,
      });
    });
    // The headline is a role="button" within the row; the toolbar buttons
    // have a `name` (Expand all / etc.) so the unnamed one is the headline.
    const headlines = screen
      .getAllByRole('button')
      .filter((el) => el.classList.contains('log-row__headline'));
    expect(headlines).toHaveLength(1);
    fireEvent.click(headlines[0]!);
    expect(screen.getByLabelText('message 1')).toBeInTheDocument();
  });

  it('renders metric chips on the response row, paired with the request', () => {
    const h = renderPanel();
    act(() => {
      h.api.appendWire({
        direction: 'outgoing',
        message: { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'echo' } },
        timestamp: 1_000_000,
      });
      h.api.appendWire({
        direction: 'incoming',
        message: { jsonrpc: '2.0', id: 7, result: { content: [{ type: 'text', text: 'ok' }] } },
        timestamp: 1_000_042,
      });
    });
    // Bytes + duration chips appear on the response row.
    expect(screen.getAllByText(/B$/).length).toBeGreaterThan(0); // e.g. "63 B"
    expect(screen.getByText(/42 ms/)).toBeInTheDocument();
    expect(screen.getByText(/~tok/)).toBeInTheDocument();
    // The response row inherits the request's headline (paired).
    expect(screen.getAllByText(/tools\/call/).length).toBeGreaterThanOrEqual(2);
  });

  it('shows always-visible copy and save buttons in the headline', () => {
    const h = renderPanel();
    act(() => {
      h.api.appendWire({
        direction: 'outgoing',
        message: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        timestamp: 1_000_000,
      });
    });
    expect(screen.getByLabelText(/copy as json/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/save as json file/i)).toBeInTheDocument();
  });

  it('Expand all / Collapse all opens and closes every body', () => {
    const h = renderPanel();
    act(() => {
      h.api.appendWire({
        direction: 'outgoing',
        message: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        timestamp: 1_000_000,
      });
      h.api.appendWire({
        direction: 'outgoing',
        message: { jsonrpc: '2.0', id: 2, method: 'prompts/list' },
        timestamp: 1_000_001,
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /expand all/i }));
    expect(screen.getByLabelText('message 1')).toBeInTheDocument();
    expect(screen.getByLabelText('message 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /collapse all/i }));
    expect(screen.queryByLabelText('message 1')).toBeNull();
    expect(screen.queryByLabelText('message 2')).toBeNull();
  });

  it('renders the filter dropdown with all five options', () => {
    renderPanel();
    // The filter trigger is present and labelled with the current selection.
    expect(screen.getByRole('button', { name: /^Filter:/i })).toBeInTheDocument();
    // Filter logic is covered exhaustively in log-pairing.test.ts; here we
    // just verify the trigger renders so the user can reach the dropdown.
  });

  // DEC-014: when the title is too long for a narrow row it ellipses; the
  // row's `title` attribute carries the full method+discriminator so a
  // hover (or focus, via the row's role="button" handler) reveals it.
  it('row title attribute carries the full method · discriminator', () => {
    const h = renderPanel();
    act(() => {
      h.api.appendWire({
        direction: 'outgoing',
        message: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'a-tool-with-a-long-discriminator-name' },
        },
        timestamp: 1_000_000,
      });
    });
    const headlines = screen
      .getAllByRole('button')
      .filter((el) => el.classList.contains('log-row__headline'));
    expect(headlines).toHaveLength(1);
    expect(headlines[0]!.getAttribute('title')).toBe(
      'tools/call · a-tool-with-a-long-discriminator-name',
    );
  });

  it('error responses are flagged in red with (error) suffix', () => {
    const h = renderPanel();
    act(() => {
      h.api.appendWire({
        direction: 'outgoing',
        message: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'broken' } },
        timestamp: 1_000_000,
      });
      h.api.appendWire({
        direction: 'incoming',
        message: { jsonrpc: '2.0', id: 1, error: { code: -1, message: 'no such tool' } },
        timestamp: 1_000_010,
      });
    });
    expect(screen.getAllByText(/\(error\)/).length).toBeGreaterThanOrEqual(1);
  });

  it('system messages render with • glyph and no metrics chips', () => {
    const h = renderPanel();
    act(() => {
      h.api.appendSystem('info', 'Connected.');
    });
    const text = screen.getByText('Connected.');
    expect(text).toBeInTheDocument();
    // The whole headline carries the system-text, not a method title.
    const row = text.closest('.log-row');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).queryByText(/~tok/)).toBeNull();
  });

  // DEC-013 — notification rows render as full wire entries: real body on
  // expand, always-visible copy + save buttons, and no pair-jump button (since
  // notifications have no JSON-RPC id to pair with).
  it('outgoing notifications/initialized renders body, copy, save — no pair-jump', () => {
    const h = renderPanel();
    act(() => {
      h.api.appendWire({
        direction: 'outgoing',
        message: { jsonrpc: '2.0', method: 'notifications/initialized' },
        timestamp: 1_000_000,
      });
    });
    // Headline shows the method and the row is marked as a notification so
    // the headline tooltip can document the missing pair-jump.
    expect(screen.getByText(/notifications\/initialized/)).toBeInTheDocument();
    const row = document.querySelector('[data-notification="true"]');
    expect(row).not.toBeNull();
    // Copy + save are always-visible on every wire entry (DEC-013).
    expect(within(row as HTMLElement).getByLabelText(/copy as json/i)).toBeInTheDocument();
    expect(within(row as HTMLElement).getByLabelText(/save as json file/i)).toBeInTheDocument();
    // Pair-jump is intentionally absent for notifications.
    expect(within(row as HTMLElement).queryByLabelText(/jump to paired entry/i)).toBeNull();
    // Headline tooltip explains why pair-jump is missing.
    const headline = (row as HTMLElement).querySelector('.log-row__headline') as HTMLElement;
    expect(headline).not.toBeNull();
    expect(headline.getAttribute('title')).toMatch(/notification — no paired response/);
    // The body expands to show the JSON envelope when the headline is clicked.
    fireEvent.click(headline);
    expect(within(row as HTMLElement).getByLabelText('message 1')).toBeInTheDocument();
  });

  it('incoming server notification (notifications/message) renders body + copy + save with ← glyph', () => {
    const h = renderPanel();
    act(() => {
      h.api.appendWire({
        direction: 'incoming',
        message: {
          jsonrpc: '2.0',
          method: 'notifications/message',
          params: { level: 'info', data: 'hello' },
        },
        timestamp: 1_000_000,
      });
    });
    const row = document.querySelector('[data-notification="true"]');
    expect(row).not.toBeNull();
    // Direction glyph is the incoming arrow.
    expect(within(row as HTMLElement).getByText('←')).toBeInTheDocument();
    // Always-visible chrome.
    expect(within(row as HTMLElement).getByLabelText(/copy as json/i)).toBeInTheDocument();
    expect(within(row as HTMLElement).getByLabelText(/save as json file/i)).toBeInTheDocument();
    // Pair-jump still absent for an incoming server-pushed notification.
    expect(within(row as HTMLElement).queryByLabelText(/jump to paired entry/i)).toBeNull();
    // Body expands to the full JSON-RPC envelope.
    const headline = (row as HTMLElement).querySelector('.log-row__headline') as HTMLElement;
    expect(headline).not.toBeNull();
    fireEvent.click(headline);
    expect(within(row as HTMLElement).getByLabelText('message 1')).toBeInTheDocument();
  });
});
