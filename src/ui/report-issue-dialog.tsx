/**
 * Modal dialog shown when the user clicks **Report issue**. Displays the
 * JSON diagnostic bundle and offers three actions: copy to clipboard,
 * download as a `.json` file, and open the GitHub bug-report form.
 *
 * The JSON is rendered in a readonly textarea so the user can select and
 * copy manually if the Clipboard API is unavailable (older browsers,
 * permission-denied contexts). The textarea is focused on open.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { bundleToJson } from '../diagnostics/build.ts';
import { snapshotBundle } from '../diagnostics/current.ts';

const ISSUE_URL = 'https://github.com/ktsaou/mcp-test-client/issues/new?template=bug_report.yml';

interface Props {
  onClose: () => void;
}

type CopyStatus = 'idle' | 'copied' | 'error';

export function ReportIssueDialog({ onClose }: Props) {
  const bundle = useMemo(() => snapshotBundle(), []);
  const json = useMemo(() => (bundle ? bundleToJson(bundle) : ''), [bundle]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');

  // Focus the textarea on mount and escape-to-close.
  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function onCopy() {
    if (!json) return;
    navigator.clipboard
      .writeText(json)
      .then(() => {
        setCopyStatus('copied');
        window.setTimeout(() => setCopyStatus('idle'), 2000);
      })
      .catch(() => {
        setCopyStatus('error');
        // Fall back: reselect the textarea so the user can Cmd/Ctrl+C manually.
        textareaRef.current?.focus();
        textareaRef.current?.select();
        window.setTimeout(() => setCopyStatus('idle'), 4000);
      });
  }

  function onDownload() {
    if (!json || !bundle) return;
    const stamp = bundle.capturedAt.replace(/[:.]/g, '-');
    const filename = `mcp-test-client-diagnostics-${stamp}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onOpenIssue() {
    window.open(ISSUE_URL, '_blank', 'noopener,noreferrer');
  }

  const copyLabel =
    copyStatus === 'copied'
      ? 'Copied'
      : copyStatus === 'error'
        ? 'Copy failed — select and ⌘/Ctrl+C'
        : 'Copy JSON';

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-issue-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="report-issue-title">Report issue</h2>

        {bundle ? (
          <>
            <p className="muted">
              This is a redacted snapshot of your current session. Bearer tokens and custom-header
              secrets are replaced with length + preview.{' '}
              <strong>Tool response payloads are not redacted</strong> — review the <code>log</code>{' '}
              array before sharing if your server returns anything sensitive.
            </p>

            <textarea
              ref={textareaRef}
              className="textarea diagnostics-textarea"
              readOnly
              value={json}
              spellCheck={false}
              aria-label="Diagnostic bundle JSON"
            />

            <div className="row">
              <button
                type="button"
                className="btn btn--primary"
                onClick={onCopy}
                aria-live="polite"
              >
                {copyLabel}
              </button>
              <button type="button" className="btn" onClick={onDownload}>
                Download .json
              </button>
              <button type="button" className="btn" onClick={onOpenIssue}>
                Open GitHub issue →
              </button>
              <span className="spacer" />
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p>No diagnostic bundle is available yet.</p>
            <p className="muted">
              The app may still be initialising. Try again after you&apos;ve connected to a server.
            </p>
            <div className="row">
              <span className="spacer" />
              <button type="button" className="btn" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
