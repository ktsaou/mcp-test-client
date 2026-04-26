/**
 * Cross-cutting handle on the live RequestPanel's send actions, so
 * the command palette (DEC-025) can dispatch "Send" and "Send without
 * validation" without lifting form state out of the panel.
 *
 * `RequestPanel` calls {@link useRegisterRequestActions} on every
 * relevant render to publish the current `{ canSend, canSendSkipValidation,
 * send, sendSkipValidation }` quartet. The palette reads it via
 * {@link useRequestActions}. When the panel unmounts we revert to a
 * no-op shape so the palette never invokes a stale closure.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface RequestActionState {
  /** True when a default Send would actually do something. */
  canSend: boolean;
  /** True when the form-mode validation-bypass would apply. */
  canSendSkipValidation: boolean;
  send: () => void;
  sendSkipValidation: () => void;
}

const NOOP: RequestActionState = {
  canSend: false,
  canSendSkipValidation: false,
  send: () => undefined,
  sendSkipValidation: () => undefined,
};

interface RequestActionsContextValue extends RequestActionState {
  register: (next: RequestActionState) => void;
  unregister: () => void;
}

const RequestActionsContext = createContext<RequestActionsContextValue | null>(null);

export function RequestActionsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RequestActionState>(NOOP);
  // Hold the latest registration in a ref so unregister can compare
  // identity — preventing a re-render race where a freshly mounted
  // RequestPanel's register fires after a stale unregister tears the
  // state down.
  const tokenRef = useRef<RequestActionState | null>(null);

  const register = useCallback((next: RequestActionState) => {
    tokenRef.current = next;
    setState(next);
  }, []);
  const unregister = useCallback(() => {
    tokenRef.current = null;
    setState(NOOP);
  }, []);

  const value = useMemo<RequestActionsContextValue>(
    () => ({ ...state, register, unregister }),
    [state, register, unregister],
  );
  return <RequestActionsContext.Provider value={value}>{children}</RequestActionsContext.Provider>;
}

export function useRequestActions(): RequestActionState {
  const ctx = useContext(RequestActionsContext);
  if (!ctx) throw new Error('useRequestActions must be used inside <RequestActionsProvider>');
  return {
    canSend: ctx.canSend,
    canSendSkipValidation: ctx.canSendSkipValidation,
    send: ctx.send,
    sendSkipValidation: ctx.sendSkipValidation,
  };
}

/**
 * Called by `RequestPanel` to publish its current send-action handles.
 * Keeps the registration in sync via `useEffect` so a state change
 * (e.g. the user fixed a validation error) immediately updates the
 * palette's verb gating.
 */
export function useRegisterRequestActions(state: RequestActionState): void {
  const ctx = useContext(RequestActionsContext);
  if (!ctx)
    throw new Error('useRegisterRequestActions must be used inside <RequestActionsProvider>');
  const { register, unregister } = ctx;
  useEffect(() => {
    register(state);
    return () => {
      unregister();
    };
  }, [state, register, unregister]);
}
