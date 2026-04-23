import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SchemaForm } from '../SchemaForm.tsx';
import type { JSONSchema } from '../types.ts';

describe('ObjectField', () => {
  it('renders nested properties', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'integer' },
          },
        },
      },
    };
    render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
  });

  it('omits optional children when their value is undefined', () => {
    const onChange = vi.fn();
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'string' },
      },
    };
    render(<SchemaForm schema={schema} value={{ a: 'x', b: 'y' }} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    // Clear the first field.
    fireEvent.change(inputs[0]!, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ b: 'y' });
  });

  it('passes required status down to the child asterisk marker', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        optional: { type: 'string' },
      },
      required: ['name'],
    };
    render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />);
    // Exactly one asterisk — the `name` field.
    const stars = screen.getAllByText('*');
    expect(stars).toHaveLength(1);
  });

  it('renders an additionalProperties editor', () => {
    const onChange = vi.fn();
    const schema: JSONSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      additionalProperties: { type: 'number' },
    };
    render(<SchemaForm schema={schema} value={{ name: 'x', a: 1, b: 2 }} onChange={onChange} />);
    // Two key inputs for the two extras.
    const keyInputs = document.querySelectorAll('input.sf-kv__key');
    expect(keyInputs).toHaveLength(2);
  });
});
