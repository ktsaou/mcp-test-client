import { useEffect, useRef, useState } from 'react';
import { Box, Button, Group, ScrollArea, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { useLog, type LogEntry } from '../state/log.tsx';
import { JsonView } from './json-view.tsx';
import { ReportIssueDialog } from './report-issue-dialog.tsx';

export function LogPanel() {
  const { entries, clear } = useLog();
  const endRef = useRef<HTMLDivElement | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries.length]);

  function handleClear() {
    clear();
    notifications.show({ message: 'Log cleared' });
  }

  return (
    <Box
      component="section"
      aria-label="Message log"
      h="100%"
      style={{
        background: 'var(--mantine-color-default-hover)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Group
        justify="space-between"
        wrap="nowrap"
        px="md"
        py={8}
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          flexShrink: 0,
        }}
      >
        <Text size="xs" tt="uppercase" c="dimmed" fw={600} style={{ letterSpacing: '0.05em' }}>
          Log ({entries.length})
        </Text>
        <Group gap="xs">
          <Tooltip
            label="View the session diagnostic bundle — copy, download, or open a GitHub issue"
            withinPortal
          >
            <Button variant="default" size="compact-sm" onClick={() => setReportOpen(true)}>
              Report issue
            </Button>
          </Tooltip>
          <Tooltip label="Clear all log entries" withinPortal>
            <Button
              variant="default"
              size="compact-sm"
              onClick={handleClear}
              disabled={entries.length === 0}
            >
              Clear
            </Button>
          </Tooltip>
        </Group>
      </Group>
      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        {entries.length === 0 ? (
          <Box p="md">
            <Text size="sm" c="dimmed">
              Wire traffic will appear here.
            </Text>
          </Box>
        ) : (
          entries.map((e) => <LogRow key={e.id} entry={e} />)
        )}
        <div ref={endRef} />
      </ScrollArea>
      {reportOpen && <ReportIssueDialog onClose={() => setReportOpen(false)} />}
    </Box>
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
  const filenameStem =
    'method' in entry.message && typeof entry.message.method === 'string'
      ? `mcp-${dir}-${entry.message.method.replace(/[^a-z0-9._-]+/gi, '_')}`
      : `mcp-${dir}`;

  return (
    <div className="log-entry">
      <span className="log-entry__ts">{ts}</span>
      <span className={`log-entry__dir log-entry__dir--${dir}`}>{dirGlyph}</span>
      <div className="log-entry__body">
        <JsonView
          value={entry.message}
          copyButton
          downloadButton
          downloadFilename={filenameStem}
          onCopied={() => notifications.show({ message: 'Message copied as JSON' })}
          onDownloaded={() => notifications.show({ message: 'Message saved' })}
        />
      </div>
    </div>
  );
}
