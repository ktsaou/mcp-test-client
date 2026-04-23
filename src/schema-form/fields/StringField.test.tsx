import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SchemaForm } from '../SchemaForm.tsx';

describe('StringField', () => {
  it('renders a text input and round-trips value', () => {
    const onChange = vi.fn();
    render(
      <SchemaForm
        schema={{ type: 'object', properties: { name: { type: 'string' } } }}
        value={{}}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith({ name: 'hello' });
  });

  it('omits an empty optional string from the output', () => {
    const onChange = vi.fn();
    render(
      <SchemaForm
        schema={{ type: 'object', properties: { name: { type: 'string' } } }}
        value={{ name: 'abc' }}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('marks required fields with an asterisk', () => {
    render(
      <SchemaForm
        schema={{
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        }}
        value={{}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('uses a date input for format=date', () => {
    render(
      <SchemaForm
        schema={{
          type: 'object',
          properties: { d: { type: 'string', format: 'date' } },
        }}
        value={{}}
        onChange={() => {}}
      />,
    );
    // happy-dom exposes type on the rendered input.
    const input = document.querySelector('input.sf-input');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('type')).toBe('date');
  });

  it('uses a password input for format=password', () => {
    render(
      <SchemaForm
        schema={{
          type: 'object',
          properties: { p: { type: 'string', format: 'password' } },
        }}
        value={{}}
        onChange={() => {}}
      />,
    );
    const input = document.querySelector('input.sf-input');
    expect(input?.getAttribute('type')).toBe('password');
  });

  it('uses a textarea when maxLength is large', () => {
    render(
      <SchemaForm
        schema={{
          type: 'object',
          properties: { body: { type: 'string', maxLength: 5000 } },
        }}
        value={{}}
        onChange={() => {}}
      />,
    );
    const ta = document.querySelector('textarea');
    expect(ta).not.toBeNull();
  });
});
