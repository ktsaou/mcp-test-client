/**
 * DEC-015 B.2 — share-link recipient: "Connection failed".
 *
 * Surfaces `useConnection().status.error.message` and offers to
 * open the existing ServerModal in edit mode (SOW-0005 D2: no
 * auto-retry; the user fixes auth and reconnects manually so we
 * stay consistent with DEC-016 connect-on-save and the no-auto-
 * connect security rule in specs/security.md §6).
 */

import { Alert, Button, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';

import { useShareLinkResolver } from '../../state/share-link-resolver.tsx';

export function ConnectionFailedModal() {
  const { state, resolveConnectionError } = useShareLinkResolver();
  const opened = state.kind === 'connection-error';
  const message = state.kind === 'connection-error' ? state.error.message : '';

  return (
    <Modal
      opened={opened}
      onClose={() => resolveConnectionError('cancel')}
      title="Connection failed"
      size="md"
      centered
    >
      <Stack gap="md">
        <Text size="sm">The server rejected the connection or could not be reached.</Text>
        <Alert color="red" variant="light" title="Error">
          {message}
        </Alert>
        <Text size="sm" c="dimmed">
          Open the server settings to adjust the URL or authentication, then click Connect.
        </Text>
        <Group justify="flex-end" gap="xs">
          <Tooltip label="Close this dialog and discard the share link" withinPortal>
            <Button variant="default" onClick={() => resolveConnectionError('cancel')}>
              Cancel
            </Button>
          </Tooltip>
          <Tooltip label="Edit the server entry, then click Connect to retry" withinPortal>
            <Button onClick={() => resolveConnectionError('open-settings')}>
              Open server settings
            </Button>
          </Tooltip>
        </Group>
      </Stack>
    </Modal>
  );
}
