import { useEffect, useRef } from 'react';

import { useLog, type LogEntry } from '../state/log.tsx';
import { JsonView } from './json-view.tsx';

export function LogPanel() {
  const { entries, clear } = useLog();
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries.length]);

  return (
    <section className="shell__log" aria-label="Message log">
      <div className="panel-header">
        <span>Log ({entries.length})</span>
        <button
          className="btn btn--ghost"
          type="button"
          onClick={clear}
          disabled={entries.length === 0}
        >
          Clear
        </button>
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
