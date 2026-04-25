import { useEffect, useState } from 'react';
import { AppShell } from '@mantine/core';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { useDiagnosticsPublisher } from '../diagnostics/useDiagnosticsPublisher.ts';
import { ConnectionBar } from './connection-bar.tsx';
import { Inspector, type Selection } from './inspector.tsx';
import { LogPanel } from './log-panel.tsx';
import { RequestPanel } from './request-panel.tsx';
import { ServerPicker } from './server-picker.tsx';
import { ShareUrlLoader } from './share-url-loader.tsx';
import { usePersistedLayout } from './use-panel-size.ts';

/** Viewport width at which the log panel moves from bottom row to right column. */
const WIDE_LAYOUT_BREAKPOINT_PX = 1400;

const HEADER_HEIGHT = 56;

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

  // Three independent layouts, persisted under mcptc:ui.layout.* keys.
  // The wide vs narrow layouts get separate persistence so swapping back and
  // forth doesn't clobber the user's preferred sizes for either.
  const [outerWide, setOuterWide] = usePersistedLayout('outer-wide');
  const [outerNarrow, setOuterNarrow] = usePersistedLayout('outer-narrow');
  const [topNarrow, setTopNarrow] = usePersistedLayout('top-narrow');
  const [mainSplit, setMainSplit] = usePersistedLayout('main-split');

  return (
    <AppShell header={{ height: HEADER_HEIGHT }} padding={0}>
      <AppShell.Header withBorder={false}>
        <ShareUrlLoader />
        <ConnectionBar />
      </AppShell.Header>

      <AppShell.Main
        style={{
          height: '100vh',
          paddingTop: HEADER_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {wide ? (
          <Group
            orientation="horizontal"
            defaultLayout={outerWide}
            onLayoutChanged={setOuterWide}
            style={{ flex: 1, minHeight: 0 }}
          >
            <Panel id="sidebar" defaultSize="20%" minSize="12%" maxSize="40%">
              <ServerPicker />
            </Panel>
            <ResizableSeparator orientation="horizontal" />
            <Panel id="main" defaultSize="55%" minSize="30%">
              <MainSplit
                selection={selection}
                onSelect={setSelection}
                layout={mainSplit}
                onLayoutChanged={setMainSplit}
              />
            </Panel>
            <ResizableSeparator orientation="horizontal" />
            <Panel id="log" defaultSize="25%" minSize="12%" maxSize="50%">
              <LogPanel />
            </Panel>
          </Group>
        ) : (
          <Group
            orientation="vertical"
            defaultLayout={outerNarrow}
            onLayoutChanged={setOuterNarrow}
            style={{ flex: 1, minHeight: 0 }}
          >
            <Panel id="top" defaultSize="70%" minSize="30%">
              <Group
                orientation="horizontal"
                defaultLayout={topNarrow}
                onLayoutChanged={setTopNarrow}
                style={{ height: '100%', width: '100%' }}
              >
                <Panel id="sidebar" defaultSize="25%" minSize="12%" maxSize="45%">
                  <ServerPicker />
                </Panel>
                <ResizableSeparator orientation="horizontal" />
                <Panel id="main" defaultSize="75%" minSize="30%">
                  <MainSplit
                    selection={selection}
                    onSelect={setSelection}
                    layout={mainSplit}
                    onLayoutChanged={setMainSplit}
                  />
                </Panel>
              </Group>
            </Panel>
            <ResizableSeparator orientation="vertical" />
            <Panel id="log" defaultSize="30%" minSize="10%" maxSize="70%">
              <LogPanel />
            </Panel>
          </Group>
        )}
      </AppShell.Main>
    </AppShell>
  );
}

interface MainSplitProps {
  selection: Selection | null;
  onSelect: (s: Selection) => void;
  layout: Record<string, number> | undefined;
  onLayoutChanged: (layout: Record<string, number>) => void;
}

function MainSplit({ selection, onSelect, layout, onLayoutChanged }: MainSplitProps) {
  return (
    <Group
      orientation="horizontal"
      defaultLayout={layout}
      onLayoutChanged={onLayoutChanged}
      style={{ height: '100%', width: '100%' }}
    >
      <Panel id="inspector" defaultSize="40%" minSize="20%">
        <Inspector selection={selection} onSelect={onSelect} />
      </Panel>
      <ResizableSeparator orientation="horizontal" />
      <Panel id="request" defaultSize="60%" minSize="30%">
        <RequestPanel selection={selection} />
      </Panel>
    </Group>
  );
}

/**
 * Themed separator. RRP gives us role=separator + keyboard handling for free;
 * we just style the hit target. The cursor is set per orientation so
 * resizing always feels right.
 */
function ResizableSeparator({ orientation }: { orientation: 'horizontal' | 'vertical' }) {
  // RRP "horizontal" Group = panels arranged in a row → drag separator
  // left/right (col-resize). "vertical" Group = panels arranged in a column
  // → drag separator up/down (row-resize).
  const isCol = orientation === 'horizontal';
  return (
    <Separator
      style={{
        background: 'var(--mantine-color-default-border)',
        flexBasis: isCol ? 4 : 4,
        cursor: isCol ? 'col-resize' : 'row-resize',
      }}
      className="resizable-separator"
    />
  );
}
