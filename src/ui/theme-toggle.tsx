import { ActionIcon, Tooltip } from '@mantine/core';

import { useTheme } from '../state/theme.tsx';

const CYCLE = ['dark', 'light', 'system'] as const;

const LABELS: Record<(typeof CYCLE)[number], string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
};

// Tiny inline SVGs so we don't pull in an icon dependency.
function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M14 9.5A6 6 0 0 1 6.5 2a6 6 0 1 0 7.5 7.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="9"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M5 13.5h6M8 11.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  function cycle() {
    const idx = CYCLE.indexOf(preference);
    const next = CYCLE[(idx + 1) % CYCLE.length] ?? 'dark';
    setPreference(next);
  }

  const label = LABELS[preference];
  const icon =
    preference === 'dark' ? <MoonIcon /> : preference === 'light' ? <SunIcon /> : <SystemIcon />;

  // Mac users see ⌘ ` ; everyone else gets Ctrl ` . Detection is
  // best-effort — a misdetect just shows the wrong glyph in the
  // tooltip; the shortcut binding (Mantine `mod+\``) keeps working.
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
  const kbdHint = `(${isMac ? '⌘' : 'Ctrl'} \`)`;

  return (
    <Tooltip label={`Theme: ${label} — click to cycle ${kbdHint}`} withinPortal>
      <ActionIcon size="lg" variant="subtle" onClick={cycle} aria-label={`Theme: ${label}`}>
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}
