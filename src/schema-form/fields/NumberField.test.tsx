import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SchemaForm } from '../SchemaForm.tsx';

describe('NumberField', () => {
  it('parses an integer and emits a number', () => {
    const onChange = vi.fn();
    render(
      <SchemaForm
        schema={{ type: 'object', properties: { age: { type: 'integer' } } }}
        value={{}}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith({ age: 42 });
  });

  it('emits undefined for an empty input (never 0)', () => {
    const onChange = vi.fn();
    render(
      <SchemaForm
        schema={{ type: 'object', properties: { n: { type: 'number' } } }}
        value={{ n: 5 }}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('rejects non-integer values when type=integer', () => {
    const onChange = vi.fn();
    render(
      <SchemaForm
        schema={{ type: 'object', properties: { n: { type: 'integer' } } }}
        value={{}}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '1.5' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('preserves zero as a real value', () => {
    const onChange = vi.fn();
    render(
      <SchemaForm
        schema={{ type: 'object', properties: { n: { type: 'number' } } }}
        value={{}}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '0' } });
    expect(onChange).toHaveBeenCalledWith({ n: 0 });
  });
});
