import { useTheme } from '../state/theme.tsx';

const CYCLE = ['dark', 'light', 'system'] as const;

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  function cycle() {
    const idx = CYCLE.indexOf(preference);
    const next = CYCLE[(idx + 1) % CYCLE.length] ?? 'dark';
    setPreference(next);
  }

  const label = preference === 'system' ? 'System' : preference === 'dark' ? 'Dark' : 'Light';

  return (
    <button
      className="btn btn--ghost"
      type="button"
      onClick={cycle}
      title={`Theme: ${label} (click to cycle)`}
    >
      {label}
    </button>
  );
}
