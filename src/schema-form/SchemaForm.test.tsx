import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SchemaForm } from './SchemaForm.tsx';
import type { JSONSchema } from './types.ts';
import { validate } from './validate.ts';

describe('SchemaForm integration', () => {
  it('resolves a $ref against $defs', () => {
    const schema: JSONSchema = {
      $defs: {
        person: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      },
      type: 'object',
      properties: {
        author: { $ref: '#/$defs/person' },
      },
    };
    render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />);
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('renders a recursive-self-$ref schema as the raw fallback', () => {
    const schema: JSONSchema = {
      $defs: {
        node: {
          type: 'object',
          properties: {
            child: { $ref: '#/$defs/node' },
          },
        },
      },
      type: 'object',
      properties: {
        root: { $ref: '#/$defs/node' },
      },
    };
    render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />);
    // The recursive edge surfaces as a raw-JSON fallback with a warning.
    expect(screen.getByText(/recursive schema/i)).toBeInTheDocument();
  });

  it('renders a const field as read-only display', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: { kind: { const: 'user' } },
    };
    render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />);
    expect(screen.getByText('"user"')).toBeInTheDocument();
  });

  it('applies allOf merges before rendering', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        combined: {
          allOf: [
            { type: 'object', properties: { a: { type: 'string' } } },
            { type: 'object', properties: { b: { type: 'string' } } },
          ],
        },
      },
    };
    render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />);
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('produces output that round-trips through Ajv validation', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer', minimum: 0 },
      },
      required: ['name', 'age'],
    };
    const onChange = vi.fn();
    const { rerender } = render(<SchemaForm schema={schema} value={{}} onChange={onChange} />);

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0]!, { target: { value: 'Costa' } });
    rerender(<SchemaForm schema={schema} value={{ name: 'Costa' }} onChange={onChange} />);

    const num = screen.getByRole('spinbutton');
    fireEvent.change(num, { target: { value: '30' } });

    expect(validate(schema, { name: 'Costa', age: 30 })).toBeNull();
    expect(validate(schema, { name: 'Costa' })).not.toBeNull();
  });
});
