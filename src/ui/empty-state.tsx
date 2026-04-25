import type { ReactNode } from 'react';
import { Box, Loader, Stack, Text } from '@mantine/core';

interface Props {
  /**
   * Primary line. Kept short — one sentence describes the state.
   */
  title: string;
  /**
   * Optional secondary line that hints at the next action.
   */
  hint?: string;
  /**
   * If true, render a small spinner before the title. Used while we're
   * actively waiting on a remote (e.g. negotiating with the server).
   */
  busy?: boolean;
  /**
   * Tone of the message. `error` paints the title red so a connect failure
   * cannot be mistaken for "you haven't tried yet".
   */
  tone?: 'neutral' | 'error';
  /**
   * Optional action slot under the hint (button, link).
   */
  action?: ReactNode;
}

/**
 * Single source of truth for "this pane has nothing useful to show right now"
 * messaging. Used by the inventory pane (DEC-011 F3) so a connect-error does
 * not silently render the same prose as "you haven't selected a server yet".
 */
export function EmptyState({ title, hint, busy = false, tone = 'neutral', action }: Props) {
  const titleColor = tone === 'error' ? 'red' : 'dimmed';
  return (
    <Box p="md">
      <Stack gap={6} align="flex-start">
        <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {busy ? <Loader size="xs" /> : null}
          <Text size="sm" c={titleColor} fw={tone === 'error' ? 600 : 400}>
            {title}
          </Text>
        </Box>
        {hint ? (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        ) : null}
        {action}
      </Stack>
    </Box>
  );
}
