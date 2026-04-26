/**
 * DEC-015 B.3 — share-link recipient: "Tool not found on this server".
 *
 * The connected server's inventory does not list the tool the link
 * referenced. Per SOW-0005 D3: confirm sends the user to the raw
 * editor pre-loaded with a JSON-RPC tools/call envelope, so they can
 * still try the call (the server may have evolved or the link may
 * predate a rename).
 */

import { Button, Code, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';

import { useShareLinkResolver } from '../../state/share-link-resolver.tsx';

export function ToolNotFoundModal() {
  const { state, resolveToolNotFound } = useShareLinkResolver();
  const opened = state.kind === 'tool-not-found';
  const tool = state.kind === 'tool-not-found' ? state.tool : '';
  const url = state.kind === 'tool-not-found' ? state.url : '';

  return (
    <Modal
      opened={opened}
      onClose={() => resolveToolNotFound('cancel')}
      title="Tool not found on this server"
      size="md"
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          This link wants to call <Code>{tool}</Code>, but the server{' '}
          <Code style={{ wordBreak: 'break-all' }}>{url}</Code> doesn&apos;t expose that tool.
        </Text>
        <Text size="sm" c="dimmed">
          The server may have evolved since the link was made.
        </Text>
        <Group justify="flex-end" gap="xs">
          <Tooltip label="Discard the link and stay on the inventory" withinPortal>
            <Button variant="default" onClick={() => resolveToolNotFound('cancel')}>
              Cancel
            </Button>
          </Tooltip>
          <Tooltip
            label="Drop the link's arguments into the raw JSON-RPC editor — you can edit before sending"
            withinPortal
          >
            <Button onClick={() => resolveToolNotFound('open-raw')}>
              Open as raw JSON-RPC anyway
            </Button>
          </Tooltip>
        </Group>
      </Stack>
    </Modal>
  );
}
