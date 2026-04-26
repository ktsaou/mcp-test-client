/**
 * DEC-015 B.1 — share-link recipient: "Add a server to open this link".
 *
 * Renders only when the resolver state kind is 'server-missing'.
 * Driven entirely from {@link useShareLinkResolver}; this component
 * owns no state and dispatches both actions back through the
 * resolver (per SOW-0005 D1: modals are dumb views).
 */

import { Button, Code, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';

import { useShareLinkResolver } from '../../state/share-link-resolver.tsx';

export function ServerMissingModal() {
  const { state, resolveServerMissing } = useShareLinkResolver();
  const opened = state.kind === 'server-missing';

  // The Modal must remain in the tree even when closed so its
  // unmount-on-confirm doesn't race the "Add" → "connecting"
  // transition. Mantine handles `opened={false}` cleanly.
  const url = state.kind === 'server-missing' ? state.url : '';

  return (
    <Modal
      opened={opened}
      onClose={() => resolveServerMissing('cancel')}
      title="Add a server to open this link"
      size="md"
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          This shareable link wants to use the MCP server at{' '}
          <Code style={{ wordBreak: 'break-all' }}>{url}</Code>. You don&apos;t have it in your list
          yet.
        </Text>
        <Text size="sm" c="dimmed">
          Adding it stores the URL only — you&apos;ll configure your own auth.
        </Text>
        <Group justify="flex-end" gap="xs">
          <Tooltip label="Discard the link and stay on this page" withinPortal>
            <Button variant="default" onClick={() => resolveServerMissing('cancel')}>
              Cancel
            </Button>
          </Tooltip>
          <Tooltip label="Add the server to your list and continue" withinPortal>
            <Button onClick={() => resolveServerMissing('add')}>Add server and continue</Button>
          </Tooltip>
        </Group>
      </Stack>
    </Modal>
  );
}
