import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clamp, usePanelSize } from './use-panel-size.ts';

const mockRead = vi.fn<(key: string) => unknown>();
const mockWrite = vi.fn<(key: string, value: unknown) => void>();

vi.mock('../state/store-instance.ts', () => ({
  appStore: {
    read: (key: string): unknown => mockRead(key),
    write: (key: string, value: unknown): void => mockWrite(key, value),
  },
}));

describe('clamp', () => {
  it('returns the value when within bounds', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
  it('returns min when below bounds', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });
  it('returns max when above bounds', () => {
    expect(clamp(200, 0, 100)).toBe(100);
  });
});

describe('usePanelSize', () => {
  beforeEach(() => {
    mockRead.mockReset();
    mockWrite.mockReset();
  });

  it('seeds from localStorage when a valid value exists', () => {
    mockRead.mockReturnValue(300);
    const { result } = renderHook(() =>
      usePanelSize('log-height', { min: 100, max: 500, default: 200 }),
    );
    expect(result.current[0]).toBe(300);
  });

  it('falls back to default when no stored value', () => {
    mockRead.mockReturnValue(undefined);
    const { result } = renderHook(() =>
      usePanelSize('log-height', { min: 100, max: 500, default: 200 }),
    );
    expect(result.current[0]).toBe(200);
  });

  it('clamps the seed into bounds', () => {
    mockRead.mockReturnValue(9999);
    const { result } = renderHook(() =>
      usePanelSize('log-height', { min: 100, max: 500, default: 200 }),
    );
    expect(result.current[0]).toBe(500);
  });

  it('persists new sizes to localStorage', () => {
    mockRead.mockReturnValue(200);
    const { result } = renderHook(() =>
      usePanelSize('log-height', { min: 100, max: 500, default: 200 }),
    );

    act(() => {
      result.current[1](350);
    });

    expect(result.current[0]).toBe(350);
    expect(mockWrite).toHaveBeenCalledWith('mcptc:ui.log-height', 350);
  });

  it('clamps writes to bounds and persists the clamped value', () => {
    mockRead.mockReturnValue(200);
    const { result } = renderHook(() =>
      usePanelSize('log-height', { min: 100, max: 500, default: 200 }),
    );

    act(() => {
      result.current[1](50); // below min
    });
    expect(result.current[0]).toBe(100);
    expect(mockWrite).toHaveBeenLastCalledWith('mcptc:ui.log-height', 100);

    act(() => {
      result.current[1](9999); // above max
    });
    expect(result.current[0]).toBe(500);
    expect(mockWrite).toHaveBeenLastCalledWith('mcptc:ui.log-height', 500);
  });
});
