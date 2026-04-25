/**
 * JSON pretty-printer rendered as React elements.
 *
 * Behaviour matches the legacy `legacy/json-pretty-printer.js` so multi-line
 * tool responses stay readable. Three things this does that JSON.stringify
 * does not:
 *
 *   1. **Newlines inside strings** are visualised as actual line breaks,
 *      with a `↵` marker at each break and the next line indented to the
 *      string's column. MCP responses regularly carry markdown / code / log
 *      lines in a `text` field; collapsing them onto one line makes them
 *      unreadable.
 *
 *   2. **Nested JSON inside strings** is detected (string starts/ends with
 *      `{}` or `[]`) and recursively pretty-printed inline, prefixed with a
 *      `[JSON]` marker. Falls back to plain rendering on parse failure,
 *      with one unescape pass for double-escaped payloads.
 *
 *   3. **Copy and download** buttons emit well-formed JSON (via
 *      `JSON.stringify(value, null, 2)`), not the syntax-highlighted DOM.
 *
 * Everything renders into React text nodes and explicit span classes — no
 * raw-HTML APIs. See specs/security.md §3.
 */

import { Fragment, useCallback, useState, type ReactNode } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';

const MAX_DEPTH = 100;
const INDENT = '  ';
const NOT_JSON = Symbol('not-json');

export interface RenderOpts {
  detectNestedJson?: boolean;
  visualizeNewlines?: boolean;
}

export interface JsonViewProps {
  value: unknown;
  opts?: RenderOpts;
  /** Show a "copy as JSON" button at the top-right of the view. */
  copyButton?: boolean;
  /** Show a "save as .json" button at the top-right of the view. */
  downloadButton?: boolean;
  /** Default download filename stem (without extension or timestamp). */
  downloadFilename?: string;
  /** Optional ARIA label so multiple views on a page are distinguishable. */
  ariaLabel?: string;
  /** Notified after a successful copy — used by callers to surface a toast. */
  onCopied?: () => void;
  /** Notified after a successful download. */
  onDownloaded?: () => void;
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 10.5V3a.5.5 0 0 1 .5-.5H11" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="m3 8.5 3.2 3 6.8-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M8 2v8m0 0L5 7.5M8 10l3-2.5M2.5 12.5h11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function JsonView({
  value,
  opts,
  copyButton,
  downloadButton,
  downloadFilename,
  ariaLabel,
  onCopied,
  onDownloaded,
}: JsonViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const json = JSON.stringify(value, null, 2);
    void navigator.clipboard
      .writeText(json)
      .then(() => {
        setCopied(true);
        onCopied?.();
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // No clipboard access — keep behaviour minimal; the toast layer in the
        // caller will surface the failure if it cares.
        window.prompt('Copy JSON:', json);
      });
  }, [value, onCopied]);

  const handleDownload = useCallback(() => {
    const json = JSON.stringify(value, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stem = downloadFilename ?? 'mcp-response';
    a.download = `${stem}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onDownloaded?.();
  }, [value, downloadFilename, onDownloaded]);

  const showActions = Boolean(copyButton || downloadButton);

  return (
    <div className="json-view-wrap">
      {showActions ? (
        <div className="json-view-actions">
          {copyButton ? (
            <Tooltip label={copied ? 'Copied' : 'Copy as JSON to clipboard'} withinPortal>
              <ActionIcon size="sm" variant="subtle" onClick={handleCopy} aria-label="copy as JSON">
                {copied ? <CheckIcon /> : <CopyIcon />}
              </ActionIcon>
            </Tooltip>
          ) : null}
          {downloadButton ? (
            <Tooltip label="Save as .json file" withinPortal>
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={handleDownload}
                aria-label="save as JSON file"
              >
                <SaveIcon />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
      <pre className="json-view" aria-label={ariaLabel}>
        {render(value, 0, opts ?? {})}
      </pre>
    </div>
  );
}

function render(v: unknown, depth: number, opts: RenderOpts): ReactNode {
  if (depth > MAX_DEPTH) return <span className="json-null">…</span>;
  if (v === null) return <span className="json-null">null</span>;
  if (typeof v === 'boolean') return <span className="json-boolean">{String(v)}</span>;
  if (typeof v === 'number') return <span className="json-number">{v}</span>;
  if (typeof v === 'string') return renderString(v, depth, opts);
  if (Array.isArray(v)) return renderArray(v, depth, opts);
  if (typeof v === 'object') return renderObject(v as Record<string, unknown>, depth, opts);
  return <span className="json-string">{JSON.stringify(v)}</span>;
}

function renderString(str: string, depth: number, opts: RenderOpts): ReactNode {
  if (opts.detectNestedJson !== false && looksLikeJson(str)) {
    const parsed = tryParseNested(str);
    if (parsed !== NOT_JSON) {
      return (
        <Fragment>
          <span className="json-string">&quot;</span>
          <span className="json-nested-marker">[JSON] </span>
          {render(parsed, depth + 1, opts)}
          <span className="json-string">&quot;</span>
        </Fragment>
      );
    }
  }

  if (opts.visualizeNewlines !== false && str.includes('\n')) {
    const continuation = INDENT.repeat(depth + 1);
    const lines = str.split('\n');
    return (
      <Fragment>
        <span className="json-string">&quot;</span>
        {lines.map((line, i) => (
          <Fragment key={i}>
            {i > 0 ? (
              <Fragment>
                <span className="json-newline-marker">↵</span>
                {'\n' + continuation}
              </Fragment>
            ) : null}
            <span className="json-string">{escapeWithinString(line)}</span>
          </Fragment>
        ))}
        <span className="json-string">&quot;</span>
      </Fragment>
    );
  }

  return <span className="json-string">{JSON.stringify(str)}</span>;
}

function renderArray(arr: unknown[], depth: number, opts: RenderOpts): ReactNode {
  if (arr.length === 0) return <span className="json-punct">[]</span>;
  const outer = INDENT.repeat(depth);
  const inner = INDENT.repeat(depth + 1);
  return (
    <Fragment>
      <span className="json-punct">[</span>
      {'\n'}
      {arr.map((item, i) => (
        <Fragment key={i}>
          {inner}
          {render(item, depth + 1, opts)}
          {i < arr.length - 1 ? <span className="json-punct">,</span> : null}
          {'\n'}
        </Fragment>
      ))}
      {outer}
      <span className="json-punct">]</span>
    </Fragment>
  );
}

function renderObject(obj: Record<string, unknown>, depth: number, opts: RenderOpts): ReactNode {
  const keys = Object.keys(obj);
  if (keys.length === 0) return <span className="json-punct">{'{}'}</span>;
  const outer = INDENT.repeat(depth);
  const inner = INDENT.repeat(depth + 1);
  return (
    <Fragment>
      <span className="json-punct">{'{'}</span>
      {'\n'}
      {keys.map((k, i) => (
        <Fragment key={k}>
          {inner}
          <span className="json-key">{JSON.stringify(k)}</span>
          <span className="json-punct">: </span>
          {render(obj[k], depth + 1, opts)}
          {i < keys.length - 1 ? <span className="json-punct">,</span> : null}
          {'\n'}
        </Fragment>
      ))}
      {outer}
      <span className="json-punct">{'}'}</span>
    </Fragment>
  );
}

function tryParseNested(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    try {
      const unescaped = str.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      return JSON.parse(unescaped);
    } catch {
      return NOT_JSON;
    }
  }
}

function looksLikeJson(str: string): boolean {
  const trimmed = str.trim();
  if (trimmed.length < 2) return false;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  return (first === '{' && last === '}') || (first === '[' && last === ']');
}

function escapeWithinString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\t/g, '\\t').replace(/\r/g, '\\r');
}
