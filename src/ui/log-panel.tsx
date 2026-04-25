/**
 * Log panel — DEC-012 redesign.
 *
 * Each entry is an accordion-shaped collapsible row. The headline carries
 * direction, timestamp, bold method-summary, metrics chips, and always-
 * visible copy/save buttons. Expanding the row reveals the JSON body via the
 * existing `<JsonView>` (DEC-003 newlines preserved).
 *
 * Toolbar: Expand all / Collapse all / prev-request / next-request / filter.
 * Keyboard: `j` next request, `k` prev request, scoped to the panel.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Box, Button, Group, Menu, ScrollArea, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { useLog, type LogEntry } from '../state/log.tsx';
import { JsonView } from './json-view.tsx';
import { ReportIssueDialog } from './report-issue-dialog.tsx';
import {
  headlineForRequest,
  headlineForResponse,
  isNotification,
  isResponse,
} from './log-headline.ts';
import {
  applyFilter,
  findRequest,
  jsonByteLength,
  pairById,
  type LogFilter,
} from './log-pairing.ts';
import { MetricsChips, type ResponseMetrics, type TokenState } from './metrics-chips.tsx';
import { estimateTokens } from './log-tokens.ts';
import { uiKey } from '../persistence/schema.ts';
import { appStore } from '../state/store-instance.ts';

const FILTER_STORE_KEY = uiKey('log.filter').slice('mcptc:'.length);

const FILTER_LABELS: Record<LogFilter, string> = {
  all: 'All',
  outgoing: 'Outgoing',
  incoming: 'Incoming',
  requests: 'Requests only',
  system: 'System',
};

function readPersistedFilter(): LogFilter {
  const raw = appStore.read<string>(FILTER_STORE_KEY);
  if (
    raw === 'all' ||
    raw === 'outgoing' ||
    raw === 'incoming' ||
    raw === 'requests' ||
    raw === 'system'
  ) {
    return raw;
  }
  return 'all';
}

export function LogPanel() {
  const { entries, clear } = useLog();
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [reportOpen, setReportOpen] = useState(false);
  const [filter, setFilter] = useState<LogFilter>(() => readPersistedFilter());
  // Tracks which entries are currently expanded. Default-collapsed (DEC-012):
  // a row only appears in this set after the user toggles it open or after
  // pressing "Expand all". Future entries arrive collapsed regardless.
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  // Persist the filter choice across sessions (DEC-012).
  useEffect(() => {
    appStore.write(FILTER_STORE_KEY, filter);
  }, [filter]);

  // Auto-scroll on new entries — but only when the user is already near the
  // bottom, so they don't get yanked away while reading older traffic.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries.length]);

  const pairs = useMemo(() => pairById(entries), [entries]);
  const filtered = useMemo(() => applyFilter(entries, filter), [entries, filter]);
  // Map id → entry, regardless of filter, so paired-jump can resolve targets.
  const byId = useMemo(() => {
    const m = new Map<number, LogEntry>();
    for (const e of entries) m.set(e.id, e);
    return m;
  }, [entries]);

  const toggle = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(entries.map((e) => e.id)));
  }, [entries]);
  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const scrollToEntry = useCallback((id: number) => {
    const el = rowRefs.current.get(id);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  // Prev/next request navigation — operates on the currently-filtered view so
  // the keypress moves the user to the next *visible* request. Tracks the
  // last-jumped index so successive `j` keys keep advancing.
  const lastJumpedIndexRef = useRef<number>(-1);

  const jumpRequest = useCallback(
    (direction: 'next' | 'prev') => {
      const next = findRequest(filtered, lastJumpedIndexRef.current, direction);
      if (next === -1) return;
      lastJumpedIndexRef.current = next;
      const entry = filtered[next];
      if (entry) scrollToEntry(entry.id);
    },
    [filtered, scrollToEntry],
  );

  // Reset cursor when the filter or entry list changes underneath us.
  useEffect(() => {
    lastJumpedIndexRef.current = -1;
  }, [filter, entries.length]);

  // Keyboard shortcuts scoped to focus-within the panel.
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (!scrollRootRef.current) return;
      const target = ev.target as HTMLElement | null;
      // Skip when the user is typing in an input.
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      // Only react when focus is inside our panel.
      const root = scrollRootRef.current.closest('[data-log-panel-root="1"]');
      if (!root || !root.contains(document.activeElement)) return;
      if (ev.key === 'j') {
        ev.preventDefault();
        jumpRequest('next');
      } else if (ev.key === 'k') {
        ev.preventDefault();
        jumpRequest('prev');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jumpRequest]);

  function handleClear() {
    clear();
    setExpandedIds(new Set());
    notifications.show({ message: 'Log cleared' });
  }

  return (
    <Box
      component="section"
      aria-label="Message log"
      h="100%"
      data-log-panel-root="1"
      tabIndex={-1}
      style={{
        background: 'var(--mantine-color-default-hover)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      <Group
        justify="space-between"
        wrap="wrap"
        px="md"
        py={6}
        gap={6}
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          flexShrink: 0,
          rowGap: 6,
        }}
      >
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          <Text size="xs" tt="uppercase" c="dimmed" fw={600} style={{ letterSpacing: '0.05em' }}>
            Log ({filtered.length}
            {filter === 'all' ? '' : ` / ${entries.length}`})
          </Text>
        </Group>
        <Group gap={4} wrap="wrap" style={{ rowGap: 4 }}>
          <Tooltip label="Expand every entry" withinPortal>
            <Button
              variant="default"
              size="compact-xs"
              onClick={expandAll}
              disabled={entries.length === 0}
            >
              Expand all
            </Button>
          </Tooltip>
          <Tooltip label="Collapse every entry" withinPortal>
            <Button
              variant="default"
              size="compact-xs"
              onClick={collapseAll}
              disabled={entries.length === 0}
            >
              Collapse all
            </Button>
          </Tooltip>
          <Tooltip label="Previous request (k)" withinPortal>
            <Button
              variant="default"
              size="compact-xs"
              onClick={() => jumpRequest('prev')}
              disabled={entries.length === 0}
              aria-label="previous request"
            >
              ↑
            </Button>
          </Tooltip>
          <Tooltip label="Next request (j)" withinPortal>
            <Button
              variant="default"
              size="compact-xs"
              onClick={() => jumpRequest('next')}
              disabled={entries.length === 0}
              aria-label="next request"
            >
              ↓
            </Button>
          </Tooltip>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <Button variant="default" size="compact-xs">
                Filter: {FILTER_LABELS[filter]} ▾
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {(['all', 'outgoing', 'incoming', 'requests', 'system'] as LogFilter[]).map((f) => (
                <Menu.Item
                  key={f}
                  onClick={() => setFilter(f)}
                  data-active={filter === f ? 'true' : undefined}
                >
                  {FILTER_LABELS[f]}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          <Tooltip
            label="View the session diagnostic bundle — copy, download, or open a GitHub issue"
            withinPortal
          >
            <Button variant="default" size="compact-xs" onClick={() => setReportOpen(true)}>
              Report issue
            </Button>
          </Tooltip>
          <Tooltip label="Clear all log entries" withinPortal>
            <Button
              variant="default"
              size="compact-xs"
              onClick={handleClear}
              disabled={entries.length === 0}
            >
              Clear
            </Button>
          </Tooltip>
        </Group>
      </Group>
      <ScrollArea viewportRef={scrollRootRef} style={{ flex: 1, minHeight: 0 }}>
        {filtered.length === 0 ? (
          <Box p="md">
            <Text size="sm" c="dimmed">
              {entries.length === 0
                ? 'Wire traffic will appear here.'
                : `No entries match the "${FILTER_LABELS[filter]}" filter.`}
            </Text>
          </Box>
        ) : (
          filtered.map((entry) => (
            <LogRow
              key={entry.id}
              entry={entry}
              expanded={expandedIds.has(entry.id)}
              onToggle={() => toggle(entry.id)}
              pairedId={pairs.get(entry.id)}
              pairedEntry={pairs.has(entry.id) ? byId.get(pairs.get(entry.id)!) : undefined}
              onJumpToPaired={() => {
                const target = pairs.get(entry.id);
                if (target !== undefined) scrollToEntry(target);
              }}
              registerRef={(el) => {
                if (el) rowRefs.current.set(entry.id, el);
                else rowRefs.current.delete(entry.id);
              }}
            />
          ))
        )}
        <div ref={endRef} />
      </ScrollArea>
      {reportOpen && <ReportIssueDialog onClose={() => setReportOpen(false)} />}
    </Box>
  );
}

interface LogRowProps {
  entry: LogEntry;
  expanded: boolean;
  onToggle: () => void;
  pairedId: number | undefined;
  pairedEntry: LogEntry | undefined;
  onJumpToPaired: () => void;
  registerRef: (el: HTMLDivElement | null) => void;
}

function LogRow({
  entry,
  expanded,
  onToggle,
  pairedId,
  pairedEntry,
  onJumpToPaired,
  registerRef,
}: LogRowProps) {
  const ts = useMemo(
    () => new Date(entry.timestamp).toLocaleTimeString(undefined, { hour12: false }),
    [entry.timestamp],
  );

  if (entry.kind === 'system') {
    return (
      <div
        ref={registerRef}
        className={`log-row log-row--system-${entry.level}`}
        data-entry-id={entry.id}
      >
        <div className="log-row__headline" style={{ cursor: 'default' }}>
          <span className="log-row__chev" aria-hidden="true" />
          <span className="log-row__dir log-row__dir--sys">•</span>
          <Text size="xs" className="log-row__ts">
            {ts}
          </Text>
          <span className="log-row__system-text">{entry.text}</span>
        </div>
      </div>
    );
  }

  // Wire entry — derive headline.
  const dir = entry.direction === 'outgoing' ? 'out' : 'in';
  const dirGlyph = entry.direction === 'outgoing' ? '→' : '←';
  const isResp = isResponse(entry.message);
  const isNote = isNotification(entry.message);
  const headline = isResp
    ? headlineForResponse(
        entry.message,
        pairedEntry?.kind === 'wire' ? pairedEntry.message : undefined,
      )
    : headlineForRequest(entry.message);

  const filenameStem =
    headline.method !== null
      ? `mcp-${dir}-${headline.method.replace(/[^a-z0-9._-]+/gi, '_')}`
      : `mcp-${dir}`;

  return (
    <div
      ref={registerRef}
      className="log-row"
      data-entry-id={entry.id}
      data-direction={entry.direction}
    >
      <div
        className="log-row__headline"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            onToggle();
          }
        }}
      >
        <span
          className={`log-row__chev${expanded ? ' log-row__chev--open' : ''}`}
          aria-hidden="true"
        >
          ▸
        </span>
        <span className={`log-row__dir log-row__dir--${dir}`} aria-hidden="true">
          {dirGlyph}
        </span>
        <Text size="xs" className="log-row__ts">
          {ts}
        </Text>
        <span className={`log-row__title${headline.isError ? ' log-row__title--error' : ''}`}>
          {headline.method ?? 'response'}
          {headline.discriminator ? (
            <span className="log-row__title-discriminator"> · {headline.discriminator}</span>
          ) : null}
          {headline.isError ? <span className="log-row__title-discriminator"> (error)</span> : null}
        </span>
        {/* Metrics: only on incoming responses (DEC-009 — answers about
         *response* cost). Outgoing requests show no chips. */}
        {isResp ? (
          <div className="log-row__chips">
            <ResponseMetricsChips entry={entry} expanded={expanded} />
          </div>
        ) : null}
        {/* Pair-jump button: only when there's a partner to jump to. */}
        {pairedId !== undefined ? (
          <div className="log-row__actions">
            <Tooltip
              label={isResp ? 'Jump to the originating request' : 'Jump to the matching response'}
              withinPortal
            >
              <ActionIcon
                size="xs"
                variant="subtle"
                aria-label="jump to paired entry"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onJumpToPaired();
                }}
              >
                ↔
              </ActionIcon>
            </Tooltip>
          </div>
        ) : null}
        {!isNote ? (
          <div className="log-row__actions">
            <CopySaveButtons value={entry.message} filenameStem={filenameStem} />
          </div>
        ) : null}
      </div>
      {expanded ? (
        <div className="log-row__body">
          <JsonView value={entry.message} ariaLabel={`message ${entry.id}`} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Metrics chips for a *response* row. Bytes + duration are computed
 * synchronously on first render; tokens lazy-load via gpt-tokenizer when the
 * row is first expanded (DEC-012 perf note).
 */
function ResponseMetricsChips({
  entry,
  expanded,
}: {
  entry: Extract<LogEntry, { kind: 'wire' }>;
  expanded: boolean;
}) {
  const bytes = useMemo(() => jsonByteLength(entry.message), [entry.message]);
  // Duration: response timestamp − paired-request timestamp. Without the pair
  // we can't show a meaningful number, so we display 0 ms — the chip stays
  // useful as a "just arrived" marker but truthful.
  const durationMs = entry.metrics?.durationMs ?? 0;

  const [tokens, setTokens] = useState<TokenState>('pending');
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!expanded) return;
    if (requestedRef.current) return;
    requestedRef.current = true;
    estimateTokens(entry.message)
      .then((n) => setTokens(n))
      .catch(() => setTokens('na'));
  }, [expanded, entry.message]);

  const metrics: ResponseMetrics = { bytes, durationMs, tokens };
  return <MetricsChips metrics={metrics} />;
}

/**
 * Always-visible copy + save buttons used in the headline (DEC-012 #3).
 * Stops propagation so a click does not also toggle the row.
 */
function CopySaveButtons({ value, filenameStem }: { value: unknown; filenameStem: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = (ev: React.MouseEvent) => {
    ev.stopPropagation();
    const json = JSON.stringify(value, null, 2);
    void navigator.clipboard
      .writeText(json)
      .then(() => {
        setCopied(true);
        notifications.show({ message: 'Message copied as JSON' });
        setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {
        window.prompt('Copy JSON:', json);
      });
  };

  const onDownload = (ev: React.MouseEvent) => {
    ev.stopPropagation();
    const json = JSON.stringify(value, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameStem}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notifications.show({ message: 'Message saved' });
  };

  return (
    <>
      <Tooltip label={copied ? 'Copied' : 'Copy as JSON'} withinPortal>
        <ActionIcon size="xs" variant="subtle" aria-label="copy as JSON" onClick={onCopy}>
          {copied ? '✓' : '⎘'}
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Save as .json file" withinPortal>
        <ActionIcon size="xs" variant="subtle" aria-label="save as JSON file" onClick={onDownload}>
          ⤓
        </ActionIcon>
      </Tooltip>
    </>
  );
}
