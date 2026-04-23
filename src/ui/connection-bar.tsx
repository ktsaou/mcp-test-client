import { useServers } from '../state/servers.tsx';
import { useConnection } from '../state/connection.tsx';
import { ThemeToggle } from './theme-toggle.tsx';

export function ConnectionBar() {
  const { active, markUsed } = useServers();
  const { status, connect, disconnect } = useConnection();

  const busy = status.state === 'connecting';
  const connected = status.state === 'connected';

  async function handleConnect() {
    if (!active) return;
    await connect(active);
    markUsed(active.id);
  }

  return (
    <header className="shell__header">
      <div className="shell__brand">MCP Test Client</div>

      {active ? (
        <div className="row row--tight muted" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ whiteSpace: 'nowrap' }}>Active:</span>
          <span
            title={active.url}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {active.name || active.url}
          </span>
        </div>
      ) : (
        <div className="muted" style={{ flex: 1 }}>
          Select or add a server in the sidebar.
        </div>
      )}

      <StatusPill />

      {connected ? (
        <button
          className="btn"
          type="button"
          onClick={() => {
            void disconnect();
          }}
        >
          Disconnect
        </button>
      ) : (
        <button
          className="btn btn--primary"
          type="button"
          disabled={!active || busy}
          onClick={() => {
            void handleConnect();
          }}
        >
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      )}

      <ThemeToggle />
    </header>
  );
}

function StatusPill() {
  const { status } = useConnection();
  switch (status.state) {
    case 'idle':
      return <span className="pill">Idle</span>;
    case 'connecting':
      return <span className="pill pill--info">Connecting</span>;
    case 'connected':
      return <span className="pill pill--ok">Connected</span>;
    case 'error':
      return (
        <span className="pill pill--error" title={status.error.message}>
          Error
        </span>
      );
  }
}
