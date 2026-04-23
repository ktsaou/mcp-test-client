import { useEffect, useState, type CSSProperties } from 'react';

import { useDiagnosticsPublisher } from '../diagnostics/useDiagnosticsPublisher.ts';
import { ConnectionBar } from './connection-bar.tsx';
import { Inspector, type Selection } from './inspector.tsx';
import { LogPanel } from './log-panel.tsx';
import { RequestPanel } from './request-panel.tsx';
import { Resizer } from './resizer.tsx';
import { ServerPicker } from './server-picker.tsx';
import { ShareUrlLoader } from './share-url-loader.tsx';
import { usePanelSize } from './use-panel-size.ts';

/** Viewport width at which the log panel moves from bottom row to right column. */
const WIDE_LAYOUT_BREAKPOINT_PX = 1400;

function useWideLayout(): boolean {
  const [wide, setWide] = useState<boolean>(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia(`(min-width: ${WIDE_LAYOUT_BREAKPOINT_PX}px)`).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${WIDE_LAYOUT_BREAKPOINT_PX}px)`);
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return wide;
}

export function Layout() {
  const [selection, setSelection] = useState<Selection | null>(null);
  useDiagnosticsPublisher();

  const wide = useWideLayout();

  // Separate persisted sizes per axis so switching layouts doesn't clobber.
  const [logHeight, setLogHeight] = usePanelSize('log-height', {
    min: 120,
    max: 800,
    default: 240,
  });
  const [logWidth, setLogWidth] = usePanelSize('log-width', {
    min: 280,
    max: 900,
    default: 440,
  });

  const logSize = wide ? logWidth : logHeight;
  const setLogSize = wide ? setLogWidth : setLogHeight;

  const shellStyle: CSSProperties & { [key: `--${string}`]: string | number } = {
    '--log-size': `${logSize}px`,
  };

  return (
    <div className="shell" style={shellStyle}>
      <ShareUrlLoader />
      <ConnectionBar />
      <ServerPicker />
      <div className="shell__main">
        <Inspector selection={selection} onSelect={setSelection} />
        <RequestPanel selection={selection} />
      </div>
      <Resizer
        axis={wide ? 'vertical' : 'horizontal'}
        size={logSize}
        onResize={setLogSize}
        label="Resize log panel"
      />
      <LogPanel />
    </div>
  );
}
