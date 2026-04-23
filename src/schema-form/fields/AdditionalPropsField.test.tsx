import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SchemaForm } from '../SchemaForm.tsx';
import type { JSONSchema } from '../types.ts';

describe('AdditionalPropsField', () => {
  const schema: JSONSchema = {
    type: 'object',
    additionalProperties: { type: 'string' },
  };

  it('adds a new key/value row when clicking "Add item"', () => {
    const onChange = vi.fn();
    render(<SchemaForm schema={schema} value={{}} onChange={onChange} />);
    const addBtn = screen.getByRole('button', { name: /add item/i });
    fireEvent.click(addBtn);
    // A new row was added but the empty key means the committed object
    // stays empty.
    expect(onChange).toHaveBeenCalledWith({});
    // One key input is now rendered.
    expect(document.querySelectorAll('input.sf-kv__key')).toHaveLength(1);
  });

  it('commits entered key and value', () => {
    const onChange = vi.fn();
    render(<SchemaForm schema={schema} value={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    const keyInput = document.querySelector('input.sf-kv__key');
    const valueInput = document.querySelector('input[type="text"]:not(.sf-kv__key)');
    fireEvent.change(keyInput!, { target: { value: 'env' } });
    fireEvent.change(valueInput!, { target: { value: 'prod' } });
    expect(onChange).toHaveBeenLastCalledWith({ env: 'prod' });
  });

  it('removes a row on click', () => {
    const onChange = vi.fn();
    render(<SchemaForm schema={schema} value={{ a: 'x', b: 'y' }} onChange={onChange} />);
    const removes = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removes[0]!);
    // Just that key dropped.
    const lastCall: unknown = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(lastCall).toEqual({ b: 'y' });
  });
});
