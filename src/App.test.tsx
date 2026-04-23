import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from './App.tsx';

describe('App', () => {
  it('renders the placeholder heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /mcp test client/i })).toBeInTheDocument();
  });

  it('sets the dark theme data attribute', () => {
    render(<App />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
