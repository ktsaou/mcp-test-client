# src/

Application source. Layout (populated across Phases 1–7 of
`TODO-MODERNIZATION.md`):

```
src/
├── main.tsx                # entry point; mounts <App />
├── App.tsx                 # top-level shell
├── index.html              # Vite entry (served by dev, copied to /dist on build)
│
├── mcp/                    # MCP client integration
│   ├── client.ts           # wraps @modelcontextprotocol/sdk Client
│   ├── logging-transport.ts # decorator capturing wire JSON-RPC for the UI log
│   ├── transports.ts       # URL → transport factory
│   └── types.ts
│
├── schema-form/            # JSON-Schema-to-form renderer
│   ├── index.tsx           # <SchemaForm /> public entry
│   ├── fields/             # one file per field type
│   ├── merge.ts            # allOf merger
│   ├── resolve-refs.ts     # $ref / $defs resolver
│   └── validate.ts         # Ajv 8 wrapper
│
├── persistence/
│   ├── store.ts            # typed localStorage wrapper, namespaced `mcptc:*`
│   ├── schema.ts           # v1 schema
│   └── migrations.ts
│
├── state/                  # React Context providers
│   ├── servers.tsx
│   ├── connection.tsx
│   ├── theme.tsx
│   └── log.tsx
│
├── ui/
│   ├── theme.css           # CSS custom properties: dark + light
│   ├── theme-toggle.tsx
│   ├── layout/             # shell layout
│   ├── server-list/        # add / edit / delete / select
│   ├── connection-bar/
│   ├── message-log/
│   └── request-panel/      # form / raw / schema-inspector tabs
│
├── share-url/              # shareable URL encoder/decoder
│   ├── encode.ts
│   └── decode.ts
│
└── utils/
    ├── json-pretty.tsx     # ported from legacy/json-pretty-printer.js
    └── llm-paste.ts        # tolerant parser for pasted tool-call JSON
```

## Import rules

- Never import `@modelcontextprotocol/sdk/client/stdio.js` (Node-only).
- Never import the SDK root entry point. Use deep imports:
  - `@modelcontextprotocol/sdk/client/index.js`
  - `@modelcontextprotocol/sdk/client/streamableHttp.js`
  - `@modelcontextprotocol/sdk/client/sse.js`
  - `@modelcontextprotocol/sdk/client/websocket.js`
  - `@modelcontextprotocol/sdk/types.js`
- Never introduce a runtime dependency without discussing it in an issue.

## Style

- React functional components. No class components.
- TypeScript strict mode.
- Plain CSS. No CSS-in-JS, no Tailwind, no preprocessors.
- Tests colocated under `tests/unit/` mirroring this tree.
