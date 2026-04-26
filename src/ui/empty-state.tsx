import type { ReactNode } from 'react';
import { Center, Stack, Text } from '@mantine/core';

export interface EmptyStateProps {
  /**
   * Optional single-line icon (Lucide-style, monochrome). Pass `null` /
   * omit to render no icon at all — DEC-028 forbids decorative
   * illustrations. Sized 24×24 by convention; the component does not
   * resize or recolour the node it receives.
   */
  icon?: ReactNode;
  /** One-line, matter-of-fact explanation of what's going on. */
  title: string;
  /**
   * Optional 1–2 line elaboration. May embed `<Anchor>` links (e.g. to
   * the upstream MCP spec) so the user can self-serve the next step.
   */
  description?: ReactNode;
  /**
   * Optional CTA — typically a Mantine `<Button>` or `<Anchor>`. Empty
   * states without a meaningful next action leave this slot empty
   * rather than render a no-op button.
   */
  action?: ReactNode;
}

/**
 * Single source of truth for "this surface has nothing to show right
 * now" messaging — DEC-028. Used by the inventory tabs (when a
 * connected server genuinely exposes zero items under that tab), the
 * log panel (no entries / filter excludes all), the sidebar
 * (no servers saved yet), and the request panel (no tool selected).
 *
 * NOT used for error surfaces — a failed list call renders a red
 * Alert inline instead, so empty-vs-error stays visually distinct
 * (DEC-028 anti-cases).
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Center p="md" h="100%" mih={120}>
      <Stack gap="sm" align="center" maw={420} ta="center">
        {icon ? <div aria-hidden="true">{icon}</div> : null}
        <Text size="sm" c="var(--color-text-muted, dimmed)" fw={500}>
          {title}
        </Text>
        {description ? (
          <Text size="xs" c="var(--color-text-muted, dimmed)" lh={1.5}>
            {description}
          </Text>
        ) : null}
        {action}
      </Stack>
    </Center>
  );
}
