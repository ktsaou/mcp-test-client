import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from './App.tsx';
import { appStore } from './state/store-instance.ts';

describe('App', () => {
  beforeEach(() => {
    appStore.clearAll();
  });

  it('renders the shell brand', () => {
    render(<App />);
    expect(screen.getByText('MCP Test Client')).toBeInTheDocument();
  });

  it('sets a dark theme data attribute by default', () => {
    render(<App />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('shows the "no servers" empty state', () => {
    render(<App />);
    expect(screen.getByText(/no servers yet/i)).toBeInTheDocument();
  });
});
