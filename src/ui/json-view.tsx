/**
 * JSON pretty-printer rendered as React elements.
 *
 * Port of the essential behaviour of legacy/json-pretty-printer.js:
 * syntax-highlights keys / strings / numbers / booleans / null, and
 * transparently parses strings that *look like* JSON so nested payloads
 * are also legible (common in MCP `content[*].text` responses).
 *
 * Everything renders into React text nodes and explicit span classes.
 * No HTML is constructed from server data — see specs/security.md §3.
 */

import { Fragment, type ReactNode } from 'react';

const MAX_DEPTH = 10;
const INDENT = '  ';

interface RenderOpts {
  detectNestedJson?: boolean;
}

export function JsonView({ value, opts }: { value: unknown; opts?: RenderOpts }) {
  return <pre className="json-view">{render(value, 0, opts ?? {})}</pre>;
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
    try {
      const parsed: unknown = JSON.parse(str);
      return (
        <Fragment>
          <span className="json-string">&quot;</span>
          {render(parsed, depth + 1, opts)}
          <span className="json-string">&quot;</span>
        </Fragment>
      );
    } catch {
      // fall through to plain rendering
    }
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

function looksLikeJson(str: string): boolean {
  const trimmed = str.trim();
  if (trimmed.length < 2) return false;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  return (first === '{' && last === '}') || (first === '[' && last === ']');
}
