import { useState } from 'react';

import { useDiagnosticsPublisher } from '../diagnostics/useDiagnosticsPublisher.ts';
import { ConnectionBar } from './connection-bar.tsx';
import { Inspector, type Selection } from './inspector.tsx';
import { LogPanel } from './log-panel.tsx';
import { RequestPanel } from './request-panel.tsx';
import { ServerPicker } from './server-picker.tsx';
import { ShareUrlLoader } from './share-url-loader.tsx';

export function Layout() {
  const [selection, setSelection] = useState<Selection | null>(null);
  useDiagnosticsPublisher();
  return (
    <div className="shell">
      <ShareUrlLoader />
      <ConnectionBar />
      <ServerPicker />
      <div className="shell__main">
        <Inspector selection={selection} onSelect={setSelection} />
        <RequestPanel selection={selection} />
      </div>
      <LogPanel />
    </div>
  );
}
