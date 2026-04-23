import { useEffect, useRef, useState } from 'react';

import { bundleToJson } from '../diagnostics/build.ts';
import { snapshotBundle } from '../diagnostics/current.ts';
import { useLog, type LogEntry } from '../state/log.tsx';
import { JsonView } from './json-view.tsx';

const ISSUE_URL = 'https://github.com/ktsaou/mcp-test-client/issues/new?template=bug_report.yml';

export function LogPanel() {
  const { entries, clear } = useLog();
  const endRef = useRef<HTMLDivElement | null>(null);
  const [reportState, setReportState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries.length]);

  function onReportIssue() {
    const bundle = snapshotBundle();
    if (!bundle) {
      setReportState('error');
      window.setTimeout(() => setReportState('idle'), 4000);
      return;
    }
    navigator.clipboard
      .writeText(bundleToJson(bundle))
      .then(() => {
        setReportState('copied');
        window.open(ISSUE_URL, '_blank', 'noopener,noreferrer');
      })
      .catch(() => {
        setReportState('error');
      })
      .finally(() => {
        window.setTimeout(() => setReportState('idle'), 4000);
      });
  }

  const reportLabel =
    reportState === 'copied'
      ? 'Copied — paste into the Diagnostics field'
      : reportState === 'error'
        ? 'Copy failed — use mcpClientDiagnostics() in console'
        : 'Report issue';

  return (
    <section className="shell__log" aria-label="Message log">
      <div className="panel-header">
        <span>Log ({entries.length})</span>
        <span className="panel-header__actions">
          <button
            className="btn btn--ghost"
            type="button"
            onClick={onReportIssue}
            title="Copy a redacted session bundle to clipboard and open the bug-report form"
          >
            {reportLabel}
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={clear}
            disabled={entries.length === 0}
          >
            Clear
          </button>
        </span>
      </div>
      <div>
        {entries.length === 0 ? (
          <div className="panel-body muted">Wire traffic will appear here.</div>
        ) : (
          entries.map((e) => <LogRow key={e.id} entry={e} />)
        )}
        <div ref={endRef} />
      </div>
    </section>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const ts = new Date(entry.timestamp).toLocaleTimeString(undefined, { hour12: false });

  if (entry.kind === 'system') {
    return (
      <div className={`log-entry log-entry--${entry.level}`}>
        <span className="log-entry__ts">{ts}</span>
        <span className="log-entry__dir">•</span>
        <span className="log-entry__body">{entry.text}</span>
      </div>
    );
  }

  const dir = entry.direction === 'outgoing' ? 'out' : 'in';
  const dirGlyph = entry.direction === 'outgoing' ? '→' : '←';

  return (
    <div className="log-entry">
      <span className="log-entry__ts">{ts}</span>
      <span className={`log-entry__dir log-entry__dir--${dir}`}>{dirGlyph}</span>
      <div className="log-entry__body">
        <JsonView value={entry.message} />
      </div>
    </div>
  );
}
