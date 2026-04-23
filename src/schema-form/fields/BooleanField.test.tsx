import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SchemaForm } from '../SchemaForm.tsx';

describe('BooleanField', () => {
  it('renders a checkbox and toggles', () => {
    const onChange = vi.fn();
    render(
      <SchemaForm
        schema={{ type: 'object', properties: { ok: { type: 'boolean' } } }}
        value={{}}
        onChange={onChange}
      />,
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ ok: true });
  });

  it('reflects an incoming true value', () => {
    render(
      <SchemaForm
        schema={{ type: 'object', properties: { ok: { type: 'boolean' } } }}
        value={{ ok: true }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
