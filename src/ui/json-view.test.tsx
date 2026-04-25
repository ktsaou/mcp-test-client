import { describe, expect, it, vi } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';

import { JsonView } from './json-view.tsx';

// JsonView's action buttons use Mantine's ActionIcon + Tooltip, which
// require a MantineProvider in the tree. Tests render via this wrapper so
// the component mounts the same way it does in the running app.
function render(ui: ReactNode) {
  return rtlRender(<MantineProvider>{ui}</MantineProvider>);
}

describe('JsonView — multi-line strings', () => {
  it('renders newlines inside strings as actual line breaks', () => {
    render(<JsonView value={{ msg: 'one\ntwo\nthree' }} />);
    // The rendered output should contain three separate text nodes, one per
    // line, plus the ↵ marker between them.
    const pre = screen.getByText((_content, node) => node?.tagName === 'PRE');
    expect(pre.textContent).toContain('one');
    expect(pre.textContent).toContain('two');
    expect(pre.textContent).toContain('three');
    // Two breaks → two markers.
    const markers = pre.querySelectorAll('.json-newline-marker');
    expect(markers).toHaveLength(2);
  });

  it('does not visualise newlines when the option is disabled', () => {
    render(<JsonView value={{ msg: 'one\ntwo' }} opts={{ visualizeNewlines: false }} />);
    const pre = screen.getByText((_c, node) => node?.tagName === 'PRE');
    expect(pre.querySelector('.json-newline-marker')).toBeNull();
    // The string is JSON-stringified, so it should contain a literal "\n".
    expect(pre.textContent).toContain('\\n');
  });
});

describe('JsonView — nested JSON detection', () => {
  it('parses and pretty-prints a JSON-shaped string with [JSON] marker', () => {
    const value = { payload: '{"k":1,"v":[true,null]}' };
    const { container } = render(<JsonView value={value} />);
    expect(container.querySelector('.json-nested-marker')?.textContent?.trim()).toBe('[JSON]');
    // The inner key should now be syntax-highlighted as a key, not a raw
    // string.
    const keys = container.querySelectorAll('.json-key');
    expect([...keys].map((k) => k.textContent)).toEqual(
      expect.arrayContaining(['"payload"', '"k"', '"v"']),
    );
  });

  it('handles double-escaped JSON (single unescape pass)', () => {
    const value = { payload: '{\\"k\\":1}' };
    const { container } = render(<JsonView value={value} />);
    expect(container.querySelector('.json-nested-marker')).not.toBeNull();
  });

  it('falls back to plain string when the contents are not actually JSON', () => {
    const value = { payload: '[not actually json after all' };
    const { container } = render(<JsonView value={value} />);
    expect(container.querySelector('.json-nested-marker')).toBeNull();
  });
});

describe('JsonView — actions', () => {
  it('exposes a copy button when copyButton is set, and writes well-formed JSON', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    const value = { a: 1, b: 'two\nlines' };
    render(<JsonView value={value} copyButton />);
    const btn = screen.getByRole('button', { name: /copy/i });
    btn.click();
    expect(writeText).toHaveBeenCalledOnce();
    const written = writeText.mock.calls[0]?.[0] as string;
    // Must be parseable and round-trip equal.
    expect(JSON.parse(written)).toEqual(value);
  });
});
