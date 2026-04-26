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
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Pill,
  ScrollArea,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { EmptyState } from './empty-state.tsx';

import { useLog, type LogEntry } from '../state/log.tsx';
import { JsonView } from './json-view.tsx';
import { ReportIssueDialog } from './report-issue-dialog.tsx';
import {
  formatHeadline,
  headlineForRequest,
  headlineForResponse,
  isNotification,
  isResponse,
  type Headline,
} from './log-headline.ts';
import {
  applyFilter,
  findRequest,
  jsonByteLength,
  pairById,
  type LogFilter,
} from './log-pairing.ts';
import { chipLevelFor, type ChipLevel } from './log-chip-visibility.ts';
import {
  MetricsChips,
  formatBytes,
  formatDuration,
  type ResponseMetrics,
  type TokenState,
} from './metrics-chips.tsx';
import { estimateTokens } from './log-tokens.ts';

const FILTER_LABELS: Record<LogFilter, string> = {
  all: 'All',
  outgoing: 'Outgoing',
  incoming: 'Incoming',
  requests: 'Requests only',
  system: 'System',
  wire: 'Wire',
  errors: 'Errors',
};

export function LogPanel() {
  const { entries, clear, filter, setFilter } = useLog();
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [reportOpen, setReportOpen] = useState(false);
  // DEC-014: drop chips one-by-one as the panel narrows so the right-edge
  // action icons stay flush across every row. A single ResizeObserver on
  // the panel root drives the level; rows pick it up via the data attribute
  // → CSS rule (`[data-chip-level="N"] .metric-chip[data-chip="…"]`).
  const [chipLevel, setChipLevel] = useState<ChipLevel>(0);
  // Tracks which entries are currently expanded. Default-collapsed (DEC-012):
  // a row only appears in this set after the user toggles it open or after
  // pressing "Expand all". Future entries arrive collapsed regardless.
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  // Observe the panel's own width — that's what every row sees once the
  // ScrollArea viewport fills it. Don't observe a row directly: at level 3
  // a row collapses to its actions only and we'd lose the signal.
  useEffect(() => {
    const el = panelRootRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1];
      if (!last) return;
      const width = last.contentRect.width;
      const next = chipLevelFor(width);
      setChipLevel((prev) => (prev === next ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Filter persistence is owned by LogProvider (DEC-025) so the
  // command palette can dispatch the same setter.

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
  // last-jumped index so successive `j` keys keep advancing, and the resolved
  // entry id so the row can render a visible "current" highlight (v1.1.20).
  const lastJumpedIndexRef = useRef<number>(-1);
  const [currentEntryId, setCurrentEntryId] = useState<number | null>(null);

  const jumpRequest = useCallback(
    (direction: 'next' | 'prev') => {
      const next = findRequest(filtered, lastJumpedIndexRef.current, direction);
      if (next === -1) return;
      lastJumpedIndexRef.current = next;
      const entry = filtered[next];
      if (entry) {
        setCurrentEntryId(entry.id);
        scrollToEntry(entry.id);
        // DEC-027 — keep focus on the cursor so the row's own Enter
        // handler always operates on the row the visible highlight
        // points at. Fires on the next tick to outrun React's
        // re-render that paints `data-current="true"`.
        const el = rowRefs.current.get(entry.id);
        // DEC-031 — the role=button click target is `.log-row__values` on
        // wire rows (chev/dir/ts/title/chips) and `.log-row__headline` on
        // system rows (which have no action buttons). Try the wire selector
        // first, fall back to the headline for system rows.
        const focusable =
          el?.querySelector<HTMLElement>('.log-row__values') ??
          el?.querySelector<HTMLElement>('.log-row__headline');
        if (focusable) requestAnimationFrame(() => focusable.focus({ preventScroll: true }));
      }
    },
    [filtered, scrollToEntry],
  );

  // DEC-030 — any click inside a row anchors the prev/next cursor on it.
  // Updates both the visible highlight (`currentEntryId`) and the index
  // `jumpRequest` reads from, so pressing ↓/j after a click continues from
  // the clicked row instead of from wherever ↑/↓ last landed.
  const handleSelect = useCallback(
    (id: number) => {
      setCurrentEntryId(id);
      const idx = filtered.findIndex((e) => e.id === id);
      if (idx >= 0) lastJumpedIndexRef.current = idx;
    },
    [filtered],
  );

  // Reset cursor when the filter or entry list changes underneath us.
  useEffect(() => {
    lastJumpedIndexRef.current = -1;
    setCurrentEntryId(null);
  }, [filter, entries.length]);

  // Keyboard shortcuts scoped to focus-within the panel.
  // DEC-027 added ↑/↓ aliases (mirroring the toolbar arrow buttons)
  // and Enter to expand the cursored row. j/k existed since v1.1.20.
  // The single-letter check stays — WCAG 2.1.4 input-skipping is the
  // load-bearing constraint; suppressing inside any input also keeps
  // the JSON-RPC raw editor (a textarea) from eating these keys.
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (!scrollRootRef.current) return;
      const target = ev.target as HTMLElement | null;
      // Skip when the user is typing in an input.
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      // Only react when focus is inside our panel.
      const root = scrollRootRef.current.closest('[data-log-panel-root="1"]');
      if (!root || !root.contains(document.activeElement)) return;
      if (ev.key === 'j' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        jumpRequest('next');
      } else if (ev.key === 'k' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        jumpRequest('prev');
      }
      // Enter is handled by each row's own onKeyDown (role=button
      // headline). `j`/`k` move both the cursor AND focus to the
      // cursored row, so Enter always reaches the right row.
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
      data-chip-level={chipLevel}
      ref={panelRootRef}
      tabIndex={-1}
      style={{
        // v1.1.9: log panel is its own frame — sits at the chrome shade
        // (`--color-bg-log` = sidebar shade). Until v1.1.8 the log
        // inherited the body shade and read as part of the editor area;
        // Costa flagged it should be darker. Pulling it to the chrome
        // shade matches VS Code Dark Modern's panel.background design
        // (bottom panel = sidebar shade, both darker than the editor).
        background: 'var(--color-bg-log)',
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
              {(
                [
                  'all',
                  'wire',
                  'outgoing',
                  'incoming',
                  'requests',
                  'system',
                  'errors',
                ] as LogFilter[]
              ).map((f) => (
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
          entries.length === 0 ? (
            <EmptyState title="Wire traffic will appear here." />
          ) : (
            // DEC-028 silent-failure 1: when a filter excludes every
            // entry, show the active filter as a removable Pill plus a
            // "Clear filter" CTA so the user can recover in place
            // instead of guessing why their log went blank.
            <EmptyState
              title={`No log entries match "${FILTER_LABELS[filter]}".`}
              description={
                <Group gap={6} justify="center" wrap="wrap">
                  <Text size="xs" c="dimmed">
                    Active filter:
                  </Text>
                  <Pill
                    withRemoveButton
                    onRemove={() => setFilter('all')}
                    aria-label={`Remove filter ${FILTER_LABELS[filter]}`}
                  >
                    {FILTER_LABELS[filter]}
                  </Pill>
                </Group>
              }
              action={
                <Button variant="subtle" size="compact-sm" onClick={() => setFilter('all')}>
                  Clear filter
                </Button>
              }
            />
          )
        ) : (
          filtered.map((entry) => (
            <LogRow
              key={entry.id}
              entry={entry}
              expanded={expandedIds.has(entry.id)}
              isCurrent={entry.id === currentEntryId}
              onToggle={() => toggle(entry.id)}
              onSelect={handleSelect}
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
  /** True when prev/next navigation just landed on this row (v1.1.20). */
  isCurrent: boolean;
  onToggle: () => void;
  /** DEC-030 — anchor the prev/next cursor on this row. */
  onSelect: (id: number) => void;
  pairedId: number | undefined;
  pairedEntry: LogEntry | undefined;
  onJumpToPaired: () => void;
  registerRef: (el: HTMLDivElement | null) => void;
}

function LogRow({
  entry,
  expanded,
  isCurrent,
  onToggle,
  onSelect,
  pairedId,
  pairedEntry,
  onJumpToPaired,
  registerRef,
}: LogRowProps) {
  const ts = useMemo(
    () => new Date(entry.timestamp).toLocaleTimeString(undefined, { hour12: false }),
    [entry.timestamp],
  );

  // DEC-031 — bytes + duration are needed both by the values-tooltip string
  // and by the chips themselves; compute once at the row level so they stay
  // in lockstep. Token state is lifted up from the chips for the same reason
  // (the tooltip omits "pending"/"na"; the chip still renders them). Hooks
  // run for every row kind (rules-of-hooks); the wire-only branches below
  // gate their use, and the system-row early return is taken AFTER these.
  const isWire = entry.kind === 'wire';
  const wireMessage = isWire ? entry.message : null;
  const wireMetrics = isWire ? entry.metrics : undefined;
  const isResp = isWire ? isResponse(entry.message) : false;
  const bytes = useMemo(
    () => (isResp && wireMessage ? jsonByteLength(wireMessage) : 0),
    [isResp, wireMessage],
  );
  const durationMs = isResp ? (wireMetrics?.durationMs ?? 0) : 0;
  const [tokens, setTokens] = useState<TokenState>('pending');
  const tokensRequestedRef = useRef(false);
  useEffect(() => {
    if (!isResp || !expanded || !wireMessage) return;
    if (tokensRequestedRef.current) return;
    tokensRequestedRef.current = true;
    estimateTokens(wireMessage)
      .then((n) => setTokens(n))
      .catch(() => setTokens('na'));
  }, [isResp, expanded, wireMessage]);

  if (entry.kind === 'system') {
    // DEC-031 — system rows have no action buttons, so wrap the whole
    // headline in a single tooltip carrying the full text. At narrow
    // widths the system text truncates via flex-overflow; hover reveals
    // the full message.
    return (
      <div
        ref={registerRef}
        className={`log-row log-row--system-${entry.level}`}
        data-entry-id={entry.id}
        data-current={isCurrent ? 'true' : undefined}
        aria-current={isCurrent ? 'true' : undefined}
      >
        <Tooltip label={entry.text} withinPortal openDelay={350} disabled={!entry.text}>
          <div
            className="log-row__headline"
            style={{ cursor: 'default' }}
            onClick={(ev) => {
              // DEC-030 — anchor the cursor on this row, but skip the click
              // when the user is finishing a text-selection drag (same
              // pattern as the wire-row values guard below).
              if (isSelectionDragInside(ev.currentTarget)) return;
              onSelect(entry.id);
            }}
          >
            <span className="log-row__chev" aria-hidden="true" />
            <span className="log-row__dir log-row__dir--sys">•</span>
            <Text size="xs" className="log-row__ts">
              {ts}
            </Text>
            <span className="log-row__system-text">{entry.text}</span>
          </div>
        </Tooltip>
      </div>
    );
  }

  // Wire entry — derive headline. Every wire entry (request, response, or
  // notification) gets the same body + copy/save chrome (DEC-013); only
  // pair-jump is skipped for notifications because they carry no JSON-RPC id.
  const dir = entry.direction === 'outgoing' ? 'out' : 'in';
  const dirGlyph = entry.direction === 'outgoing' ? '→' : '←';
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

  // DEC-029 — no native `title=` here. DEC-031 wraps the values region in
  // a single Mantine <Tooltip> instead, and action buttons remain OUTSIDE
  // that subtree so each keeps exactly one tooltip (no stacking).
  const valuesString = buildHeadlineTooltip({
    headline,
    isResp,
    isNote,
    bytes,
    durationMs,
    tokens,
  });

  return (
    <div
      ref={registerRef}
      className="log-row"
      data-entry-id={entry.id}
      data-direction={entry.direction}
      data-notification={isNote ? 'true' : undefined}
      data-current={isCurrent ? 'true' : undefined}
      aria-current={isCurrent ? 'true' : undefined}
    >
      <div className="log-row__headline">
        <Tooltip label={valuesString} withinPortal openDelay={350} disabled={!valuesString}>
          <div
            className="log-row__values"
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            onClick={(ev) => {
              // Selection guard: if the user just finished selecting text
              // inside the values region (mouseup at the end of a drag),
              // don't treat the click as an expand-toggle or as a
              // cursor-anchor (DEC-030). Standard pattern for keeping
              // click handlers alongside drag-to-select.
              if (isSelectionDragInside(ev.currentTarget)) return;
              onSelect(entry.id);
              onToggle();
            }}
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
              {headline.isError ? (
                <span className="log-row__title-discriminator"> (error)</span>
              ) : null}
            </span>
            {/* Metrics: only on incoming responses (DEC-009 — answers about
             *response* cost). Outgoing requests show no chips. The chips
             * themselves render bare here (`withTooltips={false}`); the
             * outer values tooltip surfaces the same numbers in prose form
             * to honour DEC-029's no-double-tooltip invariant. */}
            {isResp ? (
              <div className="log-row__chips">
                <MetricsChips
                  metrics={{ bytes, durationMs, tokens } satisfies ResponseMetrics}
                  withTooltips={false}
                />
              </div>
            ) : null}
          </div>
        </Tooltip>
        {/* Pair-jump button: only when there's a partner to jump to. Sits
         * OUTSIDE the values tooltip so its own per-button tooltip is the
         * only one that fires on hover (DEC-029). */}
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
        {/* Copy + save are always visible on every wire entry — request,
         * response, and notification alike (DEC-013). Outside the values
         * tooltip subtree (DEC-029). */}
        <div className="log-row__actions">
          <CopySaveButtons value={entry.message} filenameStem={filenameStem} />
        </div>
      </div>
      {expanded ? (
        <div
          className="log-row__body"
          onClick={(ev) => {
            // DEC-030 — body click anchors the cursor without toggling the
            // expand state (the user is reading; collapsing under them
            // would trap them). Same drag-select guard as the values:
            // text-drags inside the JSON view must not anchor.
            if (isSelectionDragInside(ev.currentTarget)) return;
            onSelect(entry.id);
          }}
        >
          <JsonView value={entry.message} ariaLabel={`message ${entry.id}`} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Build the values-tooltip string shown on hover over the wire-row's
 * values region (DEC-031). For responses, includes formatted bytes +
 * duration, plus tokens when the count has loaded. Pending/n/a token
 * states are intentionally omitted — those clutter the prose and the
 * expanded-row chip detail covers them.
 */
function buildHeadlineTooltip(args: {
  headline: Headline;
  isResp: boolean;
  isNote: boolean;
  bytes: number;
  durationMs: number;
  tokens: TokenState;
}): string {
  const base = formatHeadline(args.headline);
  if (args.isResp) {
    const parts = [base, formatBytes(args.bytes), formatDuration(args.durationMs)];
    if (typeof args.tokens === 'number') parts.push(`~${args.tokens} tokens`);
    return parts.join(' · ');
  }
  if (args.isNote) {
    return `${base} · notification — no paired response`;
  }
  return base;
}

/**
 * Drag-select guard shared by every clickable surface inside a log row
 * (DEC-030). Returns true when a non-empty selection is anchored or
 * focused inside `target` — i.e. the user just released a text-drag and
 * the click should NOT be treated as a row click.
 */
function isSelectionDragInside(target: Node): boolean {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!sel || sel.toString().length === 0) return false;
  const anchor = sel.anchorNode;
  const focus = sel.focusNode;
  return (anchor !== null && target.contains(anchor)) || (focus !== null && target.contains(focus));
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
