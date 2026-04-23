# Specifications

Internal technical specs. The authoritative source for design decisions.

When you change behaviour, update the relevant spec **before** changing code.
If a spec and the code disagree, the spec wins — change the code.

## Contents

- [**protocol-compliance.md**](protocol-compliance.md) — Which MCP spec version
  we target, what's mandatory vs. optional, how we negotiate.
- [**schema-rendering.md**](schema-rendering.md) — JSON Schema 2020-12 feature
  support matrix; what every form field looks like; graceful-degradation rules.
- [**persistence.md**](persistence.md) — localStorage schema, keyspace,
  versioning, migration strategy, quota handling.
- [**shareable-urls.md**](shareable-urls.md) — URL hash-fragment format for
  sharing a pre-filled request with someone else.
- [**security.md**](security.md) — Threat model. What a malicious server, a
  malicious origin, and a malicious user can each try.
- [**websocket-transport.md**](websocket-transport.md) — Custom WebSocket
  transport design (WebSocket is not in the MCP spec as of 2025-11-25).
- [**public-servers-catalog.md**](public-servers-catalog.md) — Format and
  governance of `public/public-servers.json`.
