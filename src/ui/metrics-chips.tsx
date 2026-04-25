/**
 * Metrics chips: bytes / duration / tokens. DEC-009 surfacing — used by both
 * the log row headline and the request panel's "Last result" view.
 *
 * Tokens are async — a paired `tokens` value of `'pending'` shows `~tok …`,
 * `'na'` (e.g. tokenizer failed to load) shows `— ~tok`.
 */

import { Badge, Tooltip } from '@mantine/core';

export type TokenState = number | 'pending' | 'na';

export interface ResponseMetrics {
  bytes: number;
  durationMs: number;
  tokens: TokenState;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatTokens(state: TokenState): string {
  if (state === 'pending') return '… ~tok';
  if (state === 'na') return '— ~tok';
  return `${state} ~tok`;
}

/**
 * Render the three response metrics chips. Each chip is tagged with a
 * `data-chip` discriminator so DEC-014's chip-drop CSS can hide them
 * progressively (tokens → ms → bytes) when the row narrows. Visual order
 * (bytes → ms → tokens, smallest-text first) matches the drop priority:
 * the most-likely-to-survive chip sits closest to the title.
 */
export function MetricsChips({ metrics }: { metrics: ResponseMetrics }) {
  return (
    <>
      <Tooltip label="Pretty-printed JSON byte length (UTF-8)" withinPortal>
        <Badge size="xs" variant="light" color="gray" className="metric-chip" data-chip="bytes">
          {formatBytes(metrics.bytes)}
        </Badge>
      </Tooltip>
      <Tooltip label="End-to-end duration (request sent → response received)" withinPortal>
        <Badge size="xs" variant="light" color="gray" className="metric-chip" data-chip="ms">
          {formatDuration(metrics.durationMs)}
        </Badge>
      </Tooltip>
      <Tooltip label="Estimated LLM tokens (gpt-tokenizer / o200k_base)" withinPortal>
        <Badge size="xs" variant="light" color="gray" className="metric-chip" data-chip="tokens">
          {formatTokens(metrics.tokens)}
        </Badge>
      </Tooltip>
    </>
  );
}
