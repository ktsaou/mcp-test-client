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
import { Button, Code, Group, Modal, Stack, Text, Textarea, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';

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

  // Focus the textarea on mount.
  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  function onCopy() {
    if (!json) return;
    navigator.clipboard
      .writeText(json)
      .then(() => {
        setCopyStatus('copied');
        notifications.show({ message: 'Diagnostic bundle copied' });
        window.setTimeout(() => setCopyStatus('idle'), 2000);
      })
      .catch(() => {
        setCopyStatus('error');
        textareaRef.current?.focus();
        textareaRef.current?.select();
        notifications.show({
          color: 'red',
          title: 'Could not copy',
          message: 'Select the text in the dialog and use Cmd/Ctrl+C.',
        });
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
    notifications.show({ message: `Saved ${filename}` });
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
    <Modal opened onClose={onClose} title="Report issue" size="xl">
      {bundle ? (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            This is a redacted snapshot of your current session. Bearer tokens and custom-header
            secrets are replaced with length + preview.{' '}
            <Text component="strong" inherit fw={600}>
              Tool response payloads are not redacted
            </Text>{' '}
            — review the <Code>log</Code> array before sharing if your server returns anything
            sensitive.
          </Text>

          <Textarea
            ref={textareaRef}
            readOnly
            value={json}
            spellCheck={false}
            aria-label="Diagnostic bundle JSON"
            autosize
            minRows={12}
            maxRows={20}
            styles={{
              input: {
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontSize: 'var(--mantine-font-size-xs)',
                whiteSpace: 'pre',
                overflow: 'auto',
              },
            }}
          />

          <Group justify="space-between">
            <Group gap="xs">
              <Tooltip label="Copy the diagnostic JSON to clipboard" withinPortal>
                <Button onClick={onCopy} aria-live="polite">
                  {copyLabel}
                </Button>
              </Tooltip>
              <Tooltip label="Save the diagnostic JSON as a file" withinPortal>
                <Button variant="default" onClick={onDownload}>
                  Download .json
                </Button>
              </Tooltip>
              <Tooltip label="Open the GitHub bug-report form in a new tab" withinPortal>
                <Button variant="default" onClick={onOpenIssue}>
                  Open GitHub issue →
                </Button>
              </Tooltip>
            </Group>
            <Tooltip label="Close this dialog" withinPortal>
              <Button variant="subtle" onClick={onClose}>
                Close
              </Button>
            </Tooltip>
          </Group>
        </Stack>
      ) : (
        <Stack gap="sm">
          <Text>No diagnostic bundle is available yet.</Text>
          <Text size="sm" c="dimmed">
            The app may still be initialising. Try again after you&apos;ve connected to a server.
          </Text>
          <Group justify="flex-end">
            <Tooltip label="Close this dialog" withinPortal>
              <Button variant="default" onClick={onClose}>
                Close
              </Button>
            </Tooltip>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
