import { useState } from 'react';

import { ConnectionBar } from './connection-bar.tsx';
import { Inspector, type Selection } from './inspector.tsx';
import { LogPanel } from './log-panel.tsx';
import { RequestPanel } from './request-panel.tsx';
import { ServerPicker } from './server-picker.tsx';

export function Layout() {
  const [selection, setSelection] = useState<Selection | null>(null);
  return (
    <div className="shell">
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
