import { useState } from 'react';

import { encodeShareState, type ShareState } from '../share-url/encode.ts';
import { useServers } from '../state/servers.tsx';
import type { Selection } from './inspector.tsx';

interface Props {
  selection: Selection | null;
  formValue: unknown;
  rawText: string;
  mode: 'form' | 'raw';
}

/**
 * Copy-a-shareable-link button. Generates a URL whose hash fragment encodes
 * the current request context (server URL, selected tool, arguments). Tokens
 * are deliberately excluded — the recipient must configure their own auth.
 */
export function ShareButton({ selection, formValue, rawText, mode }: Props) {
  const { active } = useServers();
  const [copied, setCopied] = useState(false);

  if (!active) return null;

  async function handleCopy() {
    if (!active) return;
    const state: ShareState = {
      v: 1,
      url: active.url,
      t:
        active.transport === 'auto' || active.transport === undefined
          ? undefined
          : active.transport,
    };
    if (selection?.kind === 'tools') {
      state.tool = selection.name;
      if (mode === 'form' && formValue && typeof formValue === 'object') {
        if (Object.keys(formValue).length > 0) {
          state.args = formValue;
        }
      } else if (mode === 'raw' && rawText) {
        state.raw = rawText;
      }
    }
    const encoded = await encodeShareState(state);
    const link = `${window.location.origin}${window.location.pathname}#${encoded}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: show the link; user can copy manually.
      window.prompt('Copy link:', link);
    }
  }

  return (
    <button
      className="btn btn--ghost"
      type="button"
      onClick={() => {
        void handleCopy();
      }}
      title="Copy a link that opens this request on another browser"
    >
      {copied ? '✓ Copied' : 'Share'}
    </button>
  );
}
