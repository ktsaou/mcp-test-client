/**
 * DEC-034 — chevron always visible, mode-conditional dropdown.
 *
 * Drives the RequestPanel through a tool selection and a form↔raw
 * switch to assert: chevron + Send shape are stable across modes;
 * form-mode dropdown still hosts "Send without validation" (DEC-019);
 * raw-mode dropdown hosts "Format JSON" + "Reset to template" with the
 * Format item disabled when text doesn't parse, and Reset restoring
 * the canonical envelope.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render as rtlRender, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { ReactNode } from 'react';

// Mocked stand-ins for the connection context. The chevron's
// `disabled={disabledByConn}` requires status === 'connected', so we
// short-circuit `useConnection` instead of standing up a real
// ConnectionProvider (which needs an actual MCP transport).
const mockConnection = {
  status: { state: 'connected' as const },
  client: {} as unknown,
  inventory: { tools: [], prompts: [], resources: [], resourceTemplates: [], errors: {} },
  connect: () => Promise.resolve('connected' as const),
  disconnect: () => Promise.resolve(),
};
vi.mock('../state/connection.tsx', () => ({ useConnection: () => mockConnection }));

import { RequestPanel } from './request-panel.tsx';
import { LogProvider } from '../state/log.tsx';
import { RequestActionsProvider } from '../state/request-actions.tsx';
import { SelectionProvider, useSelection } from '../state/selection.tsx';
import { ServersProvider } from '../state/servers.tsx';
import { __setStorageForTests } from '../state/store-instance.ts';
import { MemoryStorage } from '../persistence/store.test.ts';
import type { Selection } from './inspector.tsx';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <Notifications />
      <ServersProvider>
        <LogProvider>
          <SelectionProvider>
            <RequestActionsProvider>{children}</RequestActionsProvider>
          </SelectionProvider>
        </LogProvider>
      </ServersProvider>
    </MantineProvider>
  );
}

interface TestApi {
  setSelection: (next: Selection | null) => void;
}

function TestDriver({ onReady }: { onReady: (api: TestApi) => void }) {
  const { setSelection } = useSelection();
  onReady({ setSelection });
  return null;
}

beforeEach(() => {
  __setStorageForTests(new MemoryStorage());
});

const TOOL_NAME = 'echo';

const toolSelection: Selection = {
  kind: 'tools',
  name: TOOL_NAME,
  payload: {
    name: TOOL_NAME,
    description: 'Echoes the supplied message back to the caller.',
    inputSchema: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message'],
    },
  },
};

function renderPanel() {
  let api: TestApi | null = null;
  const result = rtlRender(
    <Wrapper>
      <TestDriver onReady={(a) => (api = a)} />
      <RequestPanel />
    </Wrapper>,
  );
  return {
    ...result,
    get api() {
      if (!api) throw new Error('TestDriver not ready');
      return api;
    },
  };
}

async function openSendMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('More send options'));
}

function getSendButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
}

async function switchToRaw() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('radio', { name: /raw/i }));
}

describe('RequestPanel — DEC-034 send chevron always visible', () => {
  it('renders the chevron in form mode with the validation-bypass item (DEC-019)', async () => {
    const h = renderPanel();
    act(() => {
      h.api.setSelection(toolSelection);
    });

    expect(screen.getByLabelText('More send options')).toBeInTheDocument();

    await openSendMenu();
    expect(
      screen.getByRole('menuitem', { name: /send without validation/i, hidden: true }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /format json/i, hidden: true })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /reset to template/i, hidden: true })).toBeNull();
  });

  it('keeps the chevron mounted after switching to raw mode and pins the Send button shape', async () => {
    const h = renderPanel();
    act(() => {
      h.api.setSelection(toolSelection);
    });

    await switchToRaw();

    expect(screen.getByLabelText('More send options')).toBeInTheDocument();

    const send = getSendButton();
    // DEC-034 — Send is always flat-right against the chevron, in
    // both form and raw modes. Falsifier: a non-zero radius here means
    // the toolbar visually jumps on mode toggle.
    expect(send.style.borderTopRightRadius).toBe('0px');
    expect(send.style.borderBottomRightRadius).toBe('0px');
  });

  it('shows the raw-mode menu items after the switch and hides the form-mode item', async () => {
    const h = renderPanel();
    act(() => {
      h.api.setSelection(toolSelection);
    });
    await switchToRaw();

    await openSendMenu();

    expect(
      screen.getByRole('menuitem', { name: /format json/i, hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /reset to template/i, hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: /send without validation/i, hidden: true }),
    ).toBeNull();
  });

  it('Format JSON pretty-prints the editor when the text parses', async () => {
    const user = userEvent.setup();
    const h = renderPanel();
    act(() => {
      h.api.setSelection(toolSelection);
    });
    await switchToRaw();

    // Replace the textarea with compact JSON; the editor seeded the
    // canonical pretty template on selection, so we type our own.
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const compact = '{"jsonrpc":"2.0","id":1,"method":"x"}';
    await user.clear(textarea);
    await user.click(textarea);
    // userEvent.type interprets braces; paste avoids that.
    await user.paste(compact);

    await openSendMenu();
    const item = screen.getByRole('menuitem', { name: /format json/i, hidden: true });
    expect(item.getAttribute('data-disabled')).toBeNull();
    await user.click(item);

    const updated = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(updated.value).toBe(JSON.stringify(JSON.parse(compact), null, 2));
    expect(updated.value).toContain('\n');
  });

  it('Format JSON is disabled when the editor does not parse as JSON', async () => {
    const user = userEvent.setup();
    const h = renderPanel();
    act(() => {
      h.api.setSelection(toolSelection);
    });
    await switchToRaw();

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.click(textarea);
    await user.paste('{not json');

    await openSendMenu();
    const item = screen.getByRole('menuitem', { name: /format json/i, hidden: true });
    // Mantine renders a disabled Menu.Item with `data-disabled`.
    expect(item.getAttribute('data-disabled')).not.toBeNull();
  });

  it('Reset to template restores the canonical tools/call envelope for the selection', async () => {
    const user = userEvent.setup();
    const h = renderPanel();
    act(() => {
      h.api.setSelection(toolSelection);
    });
    await switchToRaw();

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const canonical = textarea.value;
    expect(canonical).toContain('"tools/call"');
    expect(canonical).toContain(`"name": "${TOOL_NAME}"`);

    await user.clear(textarea);
    await user.click(textarea);
    await user.paste('{"scrambled":true}');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('{"scrambled":true}');

    await openSendMenu();
    const item = screen.getByRole('menuitem', { name: /reset to template/i, hidden: true });
    expect(item.getAttribute('data-disabled')).toBeNull();
    await user.click(item);

    // The textarea content matches the canonical envelope from the
    // initial form→raw seed — same single-source helper, no drift.
    const restored = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(restored.value).toBe(canonical);
  });
});
