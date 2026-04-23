import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SchemaForm } from '../SchemaForm.tsx';

describe('EnumField', () => {
  it('renders a select with all enum options', () => {
    render(
      <SchemaForm
        schema={{
          type: 'object',
          properties: { color: { enum: ['red', 'green', 'blue'] } },
        }}
        value={{}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('option', { name: 'red' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'green' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'blue' })).toBeInTheDocument();
  });

  it('shows an "— unset —" option when not required', () => {
    render(
      <SchemaForm
        schema={{
          type: 'object',
          properties: { color: { enum: ['red', 'blue'] } },
        }}
        value={{}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('option', { name: /unset/i })).toBeInTheDocument();
  });

  it('emits the selected value', () => {
    const onChange = vi.fn();
    render(
      <SchemaForm
        schema={{
          type: 'object',
          properties: { color: { enum: ['red', 'blue'] } },
        }}
        value={{}}
        onChange={onChange}
      />,
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith({ color: 'blue' });
  });
});
