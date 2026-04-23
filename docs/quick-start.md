# Quick start

You have an MCP server URL. You want to poke at it.

## 1. Open the app

Either:

- **Hosted**: https://ktsaou.github.io/mcp-test-client/ — zero install.
- **Local**:
  ```bash
  git clone https://github.com/ktsaou/mcp-test-client
  cd mcp-test-client
  npm install
  npm run dev
  ```
  open http://localhost:5173.

## 2. Add a server

Click **+ Add** in the left sidebar.

- **URL** — paste the full URL including scheme. `https://…` and `wss://…`
  work. Plain `http://` and `ws://` only work when the server is on
  localhost (browser mixed-content rules).
- **Name** — a friendly label. Optional; defaults to the URL.
- **Transport**:
  - **Auto** is almost always correct. We pick WebSocket for `wss://`,
    Streamable HTTP for `https://`.
  - Choose **SSE (legacy)** if the server is still on the 2024-11-05
    transport and the browser's default streaming-HTTP negotiation
    fails.
  - **WebSocket** — custom extension, not in the MCP spec. Only a
    handful of servers speak it.
- **Authentication**:
  - **None** — most public servers.
  - **Bearer token** — the token goes on every request as
    `Authorization: Bearer …`.
  - **Custom header** — for servers that use a non-standard auth header.

Click **Save**. The new server is selected automatically.

## 3. Connect

Click **Connect** in the top bar.

- The connection status turns to **Connected**.
- The middle panel populates with the server's tools, prompts,
  resources, and resource templates.
- The bottom log shows every JSON-RPC message that flowed over the wire
  in both directions.

## 4. Call a tool

Click a tool in the **tools** tab. The right panel auto-generates an
interactive form from the tool's JSON Schema — one field per
parameter, with the right widget for each type (text, number, enum
dropdown, boolean checkbox, nested objects, array builders, etc.).

Fill in the required fields. Click **Send**. The response renders
below the form and the full wire traffic appears in the bottom log.

If the schema uses a construct the form renderer can't handle cleanly,
it falls back to a raw JSON editor seeded with a valid-shaped default
— so you can still send the request.

Every request panel has a **Raw** tab that switches from the form to
direct JSON-RPC editing, in case you want to exercise edge cases or
malformed inputs deliberately.

## 5. Other features

- **Prompts / Resources / Resource templates** tabs work identically —
  click an entry, the template lands, click Send.
- **Theme toggle** — top right corner. Cycles Dark → Light → System.
- **Clear log** button wipes the message panel; everything is
  in-memory, so nothing is persisted.
- **Delete** a server from the sidebar when you're done with it. It and
  all its saved state (tool params, history) are gone.

## Trouble?

- **Connection fails with no error** — most likely CORS. Read
  [`cors-explainer.md`](cors-explainer.md).
- **"Transport selection" confusion** — check
  [`troubleshooting.md`](troubleshooting.md).
