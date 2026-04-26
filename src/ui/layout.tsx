import { useEffect, useRef, useState } from 'react';
import { ActionIcon, AppShell, Box, Drawer, Tabs, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Group, Panel, Separator, type PanelImperativeHandle } from 'react-resizable-panels';

import { useDiagnosticsPublisher } from '../diagnostics/useDiagnosticsPublisher.ts';
import { useSidebarCollapse } from '../state/sidebar-collapse.tsx';
import { ConnectionBar } from './connection-bar.tsx';
import { Inspector } from './inspector.tsx';
import { LogPanel } from './log-panel.tsx';
import { ConnectionFailedModal } from './modals/ConnectionFailedModal.tsx';
import { ServerMissingModal } from './modals/ServerMissingModal.tsx';
import { ToolNotFoundModal } from './modals/ToolNotFoundModal.tsx';
import { RequestPanel } from './request-panel.tsx';
import { ServerPicker } from './server-picker.tsx';
import { ShareUrlLoader } from './share-url-loader.tsx';
import { usePersistedLayout } from './use-panel-size.ts';

/** Viewport width at which the log panel moves from bottom row to right column. */
const WIDE_LAYOUT_BREAKPOINT_PX = 1400;

/**
 * Below this width we drop the resizable panel layout entirely and switch
 * to a single-pane stacked layout: sidebar in a Drawer, main area as Tabs
 * (Inventory / Request / Log).
 */
const MOBILE_LAYOUT_BREAKPOINT_PX = 768;

const HEADER_HEIGHT = 56;

type MobileTab = 'inventory' | 'request' | 'log';

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

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M2 4h12M2 8h12M2 12h12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Layout() {
  useDiagnosticsPublisher();

  const wide = useWideLayout();
  // useMediaQuery returns undefined on first render before the listener wires
  // up; treat undefined as "not mobile" so the desktop layout is the SSR /
  // first-paint default and the resizer state never bleeds into the mobile
  // path on first paint.
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_LAYOUT_BREAKPOINT_PX - 1}px)`) ?? false;

  // Persisted desktop layouts are keyed under their existing `outer-wide` /
  // `outer-narrow` / `top-narrow` / `main-split` features. The mobile mode
  // does not use react-resizable-panels at all, so its sizes never reach
  // localStorage and cannot pollute the desktop sessions (and vice versa).
  const [outerWide, setOuterWide] = usePersistedLayout('outer-wide');
  const [outerNarrow, setOuterNarrow] = usePersistedLayout('outer-narrow');
  const [topNarrow, setTopNarrow] = usePersistedLayout('top-narrow');
  const [mainSplit, setMainSplit] = usePersistedLayout('main-split');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('inventory');

  // DEC-027 — sidebar collapse drive. The `s` shortcut flips
  // `collapsed`; the imperative panel ref translates that into the
  // `react-resizable-panels` collapse/expand call. One ref per
  // layout branch — they unmount each other on the breakpoint flip,
  // so only one is ever live at a time.
  const { collapsed } = useSidebarCollapse();
  const sidebarPanelRefWide = useRef<PanelImperativeHandle | null>(null);
  const sidebarPanelRefNarrow = useRef<PanelImperativeHandle | null>(null);
  useEffect(() => {
    const ref = sidebarPanelRefWide.current ?? sidebarPanelRefNarrow.current;
    if (!ref) return;
    if (collapsed) ref.collapse();
    else ref.expand();
  }, [collapsed, wide, isMobile]);

  // If the user resizes from mobile back to desktop, close the drawer so
  // its overlay doesn't block the now-visible sidebar.
  useEffect(() => {
    if (!isMobile && drawerOpen) setDrawerOpen(false);
  }, [isMobile, drawerOpen]);

  return (
    <AppShell header={{ height: HEADER_HEIGHT }} padding={0}>
      <AppShell.Header withBorder={false}>
        <ShareUrlLoader />
        <ConnectionBar
          leftSlot={
            isMobile ? (
              <Tooltip label="Open server list" withinPortal>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  aria-label="Open server list"
                  onClick={() => setDrawerOpen(true)}
                >
                  <HamburgerIcon />
                </ActionIcon>
              </Tooltip>
            ) : null
          }
        />
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
        {isMobile ? (
          <MobileLayout
            tab={mobileTab}
            onTabChange={setMobileTab}
            drawerOpen={drawerOpen}
            onDrawerClose={() => setDrawerOpen(false)}
          />
        ) : wide ? (
          <Group
            orientation="horizontal"
            defaultLayout={outerWide}
            onLayoutChanged={setOuterWide}
            style={{ flex: 1, minHeight: 0 }}
          >
            <Panel
              id="sidebar"
              defaultSize="20%"
              minSize="12%"
              maxSize="40%"
              collapsible
              collapsedSize={0}
              panelRef={sidebarPanelRefWide}
            >
              <ServerPicker />
            </Panel>
            <ResizableSeparator orientation="horizontal" />
            <Panel id="main" defaultSize="55%" minSize="30%">
              <MainSplit layout={mainSplit} onLayoutChanged={setMainSplit} />
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
                <Panel
                  id="sidebar"
                  defaultSize="25%"
                  minSize="12%"
                  maxSize="45%"
                  collapsible
                  collapsedSize={0}
                  panelRef={sidebarPanelRefNarrow}
                >
                  <ServerPicker />
                </Panel>
                <ResizableSeparator orientation="horizontal" />
                <Panel id="main" defaultSize="75%" minSize="30%">
                  <MainSplit layout={mainSplit} onLayoutChanged={setMainSplit} />
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

      {/*
        DEC-015 / SOW-0005 Chunk B — share-link precondition modals.
        Mounted at the layout root so they overlay every layout branch
        (desktop wide / desktop narrow / mobile tabs). Each modal
        reads the resolver state and is opened/closed by its kind.
      */}
      <ServerMissingModal />
      <ConnectionFailedModal />
      <ToolNotFoundModal />
    </AppShell>
  );
}

interface MainSplitProps {
  layout: Record<string, number> | undefined;
  onLayoutChanged: (layout: Record<string, number>) => void;
}

function MainSplit({ layout, onLayoutChanged }: MainSplitProps) {
  return (
    <Group
      orientation="horizontal"
      defaultLayout={layout}
      onLayoutChanged={onLayoutChanged}
      style={{ height: '100%', width: '100%' }}
    >
      <Panel id="inspector" defaultSize="40%" minSize="20%">
        <Inspector />
      </Panel>
      <ResizableSeparator orientation="horizontal" />
      <Panel id="request" defaultSize="60%" minSize="30%">
        <RequestPanel />
      </Panel>
    </Group>
  );
}

interface MobileLayoutProps {
  tab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  drawerOpen: boolean;
  onDrawerClose: () => void;
}

function MobileLayout({ tab, onTabChange, drawerOpen, onDrawerClose }: MobileLayoutProps) {
  return (
    <>
      <Drawer
        opened={drawerOpen}
        onClose={onDrawerClose}
        title="Servers"
        position="left"
        size="85%"
        padding={0}
        styles={{ body: { padding: 0, height: '100%' } }}
      >
        <Box style={{ height: '100%' }} onClick={onDrawerClose}>
          <ServerPicker />
        </Box>
      </Drawer>

      <Tabs
        value={tab}
        onChange={(v) => {
          if (v === 'inventory' || v === 'request' || v === 'log') onTabChange(v);
        }}
        keepMounted
        variant="default"
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        <Tabs.List style={{ flexShrink: 0 }}>
          <Tabs.Tab value="inventory">Inventory</Tabs.Tab>
          <Tabs.Tab value="request">Request</Tabs.Tab>
          <Tabs.Tab value="log">Log</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel
          value="inventory"
          style={{ flex: 1, minHeight: 0, display: tab === 'inventory' ? 'flex' : 'none' }}
        >
          <Box style={{ flex: 1, minHeight: 0, width: '100%' }}>
            <Inspector />
          </Box>
        </Tabs.Panel>
        <Tabs.Panel
          value="request"
          style={{ flex: 1, minHeight: 0, display: tab === 'request' ? 'flex' : 'none' }}
        >
          <Box style={{ flex: 1, minHeight: 0, width: '100%' }}>
            <RequestPanel />
          </Box>
        </Tabs.Panel>
        <Tabs.Panel
          value="log"
          style={{ flex: 1, minHeight: 0, display: tab === 'log' ? 'flex' : 'none' }}
        >
          <Box style={{ flex: 1, minHeight: 0, width: '100%' }}>
            <LogPanel />
          </Box>
        </Tabs.Panel>
      </Tabs>
    </>
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
