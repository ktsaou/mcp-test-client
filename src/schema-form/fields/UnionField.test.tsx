import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SchemaForm } from '../SchemaForm.tsx';
import type { JSONSchema } from '../types.ts';

describe('UnionField', () => {
  it('renders one tab per anyOf branch', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        v: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
    };
    render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent('string');
    expect(tabs[1]).toHaveTextContent('number');
  });

  it('uses const-discriminator labels when present', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        node: {
          oneOf: [
            {
              type: 'object',
              properties: {
                kind: { const: 'file' },
                path: { type: 'string' },
              },
            },
            {
              type: 'object',
              properties: {
                kind: { const: 'directory' },
                path: { type: 'string' },
              },
            },
          ],
        },
      },
    };
    render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveTextContent('file');
    expect(tabs[1]).toHaveTextContent('directory');
  });

  it('emits the branch default when switching tabs', () => {
    const onChange = vi.fn();
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        v: {
          anyOf: [
            { type: 'string', default: 'A' },
            { type: 'number', default: 7 },
          ],
        },
      },
    };
    render(<SchemaForm schema={schema} value={{ v: 'hello' }} onChange={onChange} />);
    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[1]!);
    expect(onChange).toHaveBeenLastCalledWith({ v: 7 });
  });
});
