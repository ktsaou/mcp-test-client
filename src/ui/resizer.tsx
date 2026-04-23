/**
 * Drag-to-resize handle used between panels.
 *
 * Renders a thin, focusable divider. Pointer drag adjusts size via the
 * provided `onResize` callback; keyboard ArrowUp/Down (or Left/Right on
 * a vertical handle) nudges by `step`.
 */

import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react';

export type ResizeAxis = 'horizontal' | 'vertical';

interface ResizerProps {
  /** 'horizontal' = splits top/bottom (drag vertically).
   *  'vertical'   = splits left/right (drag horizontally). */
  axis: ResizeAxis;
  /** Current panel size, in pixels. */
  size: number;
  /** Called with the proposed new size. The owner clamps / persists. */
  onResize: (next: number) => void;
  /** Step size for keyboard nudges. */
  step?: number;
  /** ARIA label for screen readers. */
  label: string;
}

export function Resizer({ axis, size, onResize, step = 16, label }: ResizerProps) {
  const dragStart = useRef<{ startSize: number; startPos: number } | null>(null);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const pos = axis === 'horizontal' ? event.clientY : event.clientX;
      dragStart.current = { startSize: size, startPos: pos };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [axis, size],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const start = dragStart.current;
      if (!start) return;
      const pos = axis === 'horizontal' ? event.clientY : event.clientX;
      // When the handle is between main (above/left) and the sized panel
      // (below/right), dragging further from the panel *shrinks* it.
      const delta = start.startPos - pos;
      onResize(start.startSize + delta);
    },
    [axis, onResize],
  );

  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current) {
      dragStart.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const key = event.key;
      const grow = axis === 'horizontal' ? 'ArrowUp' : 'ArrowLeft';
      const shrink = axis === 'horizontal' ? 'ArrowDown' : 'ArrowRight';
      if (key === grow) {
        event.preventDefault();
        onResize(size + step);
      } else if (key === shrink) {
        event.preventDefault();
        onResize(size - step);
      }
    },
    [axis, size, step, onResize],
  );

  return (
    <div
      role="separator"
      aria-orientation={axis === 'horizontal' ? 'horizontal' : 'vertical'}
      aria-label={label}
      aria-valuenow={size}
      tabIndex={0}
      className={`resizer resizer--${axis}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    />
  );
}
