import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SchemaForm } from '../SchemaForm.tsx';
import type { JSONSchema } from '../types.ts';

describe('ArrayField', () => {
  it('adds and removes plain array rows', () => {
    const onChange = vi.fn();
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
      },
    };
    const { rerender } = render(
      <SchemaForm schema={schema} value={{ tags: [] }} onChange={onChange} />,
    );
    const addBtn = screen.getByRole('button', { name: /add item/i });
    fireEvent.click(addBtn);
    expect(onChange).toHaveBeenCalledWith({ tags: [''] });

    // Re-render with the added item and verify removal.
    onChange.mockReset();
    rerender(<SchemaForm schema={schema} value={{ tags: ['a', 'b'] }} onChange={onChange} />);
    const removes = screen.getAllByRole('button', { name: /remove item/i });
    fireEvent.click(removes[0]!);
    expect(onChange).toHaveBeenCalledWith({ tags: ['b'] });
  });

  it('renders checkboxes for array-of-enum', () => {
    const onChange = vi.fn();
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        pick: { type: 'array', items: { enum: ['a', 'b', 'c'] } },
      },
    };
    render(<SchemaForm schema={schema} value={{ pick: [] }} onChange={onChange} />);
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    fireEvent.click(boxes[1]!);
    expect(onChange).toHaveBeenCalledWith({ pick: ['b'] });
  });

  it('unchecks array-of-enum values', () => {
    const onChange = vi.fn();
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        pick: { type: 'array', items: { enum: ['a', 'b'] } },
      },
    };
    render(<SchemaForm schema={schema} value={{ pick: ['a', 'b'] }} onChange={onChange} />);
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[0]!);
    expect(onChange).toHaveBeenCalledWith({ pick: ['b'] });
  });

  it('renders one slot per prefixItems position', () => {
    const onChange = vi.fn();
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        triple: {
          type: 'array',
          prefixItems: [
            { type: 'string', title: 'Column' },
            { type: 'string', title: 'Operator' },
            { type: 'number', title: 'Value' },
          ],
        },
      },
    };
    render(<SchemaForm schema={schema} value={{ triple: ['col', '=', 3] }} onChange={onChange} />);
    expect(screen.getByText('Column')).toBeInTheDocument();
    expect(screen.getByText('Operator')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('updates a specific tuple slot without disturbing others', () => {
    const onChange = vi.fn();
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        pair: {
          type: 'array',
          prefixItems: [{ type: 'string' }, { type: 'number' }],
        },
      },
    };
    render(<SchemaForm schema={schema} value={{ pair: ['name', 7] }} onChange={onChange} />);
    const textInputs = screen.getAllByRole('textbox');
    const numberInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(textInputs[0]!, { target: { value: 'age' } });
    expect(onChange).toHaveBeenLastCalledWith({ pair: ['age', 7] });

    onChange.mockReset();
    fireEvent.change(numberInputs[0]!, { target: { value: '9' } });
    expect(onChange).toHaveBeenLastCalledWith({ pair: ['name', 9] });
  });
});
