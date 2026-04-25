# DEC-024 — Output-schema compile resilience (2026-04-25)

**Problem.** Costa connected to a real authenticated MCP server (a
multi-vendor aggregator exposing ~60 tools across Brave, Jina, Z.AI,
Exa, Cloudflare, etc.) and saw the entire `tools/list` response fail
with a stack trace originating in the MCP SDK's Ajv:

```
Error compiling schema, function code: const schema0 = scope.schema[0];
  const formats0 = scope.formats[0]; ...
  getValidator @ ajv-provider.js:67
  cacheToolMetadata @ index.js:546
  listTools @ index.js:568
  listTools @ client.ts:89
```

No tools rendered. The user is blind to a server they could otherwise
use.

## Root cause

The MCP SDK 1.29's `Client.listTools()` (in
`node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js`)
calls `cacheToolMetadata(result.tools)` immediately after fetching
the tool list (line 568). `cacheToolMetadata` iterates every tool
and, for any tool with an `outputSchema`, eagerly compiles a
validator:

```js
// index.js, line 543-548
for (const tool of tools) {
  if (tool.outputSchema) {
    const toolValidator = this._jsonSchemaValidator.getValidator(tool.outputSchema);
    this._cachedToolOutputValidators.set(tool.name, toolValidator);
  }
  // ...
}
```

`getValidator` (in `validation/ajv-provider.js` line 67) calls
`this._ajv.compile(schema)` directly. **If `compile()` throws — for
any reason: malformed schema, unsupported draft feature, regex too
complex for Ajv's code generator — the exception propagates up
through `cacheToolMetadata`, through `listTools()`, to our
`client.ts:89`.** No try/catch anywhere in the chain.

**One un-compilable output schema blocks the entire tools list.**

## The offending tool in this report

`brave-brave_image_search` is the only tool in Costa's payload with
an `outputSchema`. The schema declares
`$schema: "http://json-schema.org/draft-07/schema#"` and uses
`format: "uri"`, `format: "date-time"`, plus a complex `pattern`
for `page_fetched`. The truncated Ajv error in the report shows
`scope.formats[0]` and `scope.formats[1]` references but the tail
that would name the failing keyword is cut off in the paste, so
the precise feature breaking compilation is not yet identified.

The fix below is independent of the precise cause — the SDK's
eager-compile-with-no-catch is the real bug regardless of which
schema trips it.

## Options considered

### Option A — Custom validator wrapper

Pass a `jsonSchemaValidator` option to `new Client(CLIENT_INFO, ...)`.
The wrapper delegates to `AjvJsonSchemaValidator` for the happy
path; on `compile()` throw, it logs a system-warning to our log
panel ("output schema for tool _name_ failed to compile — output
validation disabled: _reason_") and returns a permissive validator
that passes input through. The connection stays usable; the user
sees the tool and the warning.

```ts
// Sketch only — not committed.
class TolerantValidator {
  #inner = new AjvJsonSchemaValidator();
  getValidator(schema: unknown) {
    try {
      return this.#inner.getValidator(schema);
    } catch (e) {
      logSystemWarning(`output schema compile failed: ${e.message}`);
      return () => ({ valid: true, data: arguments[0], errorMessage: undefined });
    }
  }
}
```

The SDK's `Client` constructor takes
`{ jsonSchemaValidator?: JsonSchemaValidator }` per
`new Client(CLIENT_INFO, { capabilities: {}, jsonSchemaValidator })`.

**Pros.** Small (~30 lines + a test). No SDK fork. Catches future
eager-compile paths the SDK might add. Output-validation is only
disabled for the broken tool.

**Cons.** Silently downgrades output-schema validation for the
offender (the warning makes it not invisible, but it is a
downgrade).

### Option B — Patch the SDK locally + upstream PR

Use `patch-package` to wrap the per-tool compile in try/catch
inside `cacheToolMetadata`. Open an upstream PR to
`modelcontextprotocol/typescript-sdk`.

**Pros.** Fixes the actual SDK bug at the source. Other browser-
side SDK consumers benefit.

**Cons.** Adds `patch-package` machinery to the build. Maintenance
burden until the upstream PR merges. Bundle size implication: the
patched SDK ships in our `dist/`; `patch-package` runs at
`postinstall` and the patched file is what gets bundled.

### Option C — Both: A now, B as a follow-up

Ship A in v1.1.3. Submit B upstream in parallel. Drop the local
wrapper once the SDK PR merges and we bump the dependency.

**Pros.** User unblocked immediately. The right fix lands long-term.

**Cons.** Two PRs.

## Decision

Pending Costa's call — A vs B vs C. Recommendation logged: **C**.

## Sub-item checklist (assuming C)

- [ ] **A.1 — TolerantValidator class** in `src/mcp/tolerant-validator.ts`.
      Implements the `JsonSchemaValidator` interface from the SDK.
      Unit tests cover: valid schema (delegates), throwing schema
      (returns permissive validator + emits warning).
- [ ] **A.2 — Wire it into `McpClient`.** Constructor passes the
      wrapper as `jsonSchemaValidator` to `new Client(...)`. Existing
      tests stay green.
- [ ] **A.3 — Surface the warning.** A `system` log entry with
      `level: warn` per failing tool, headline
      `output schema compile failed · <tool name>`, body carrying
      the Ajv error message + the schema text (so the developer
      can debug).
- [ ] **A.4 — e2e test.** A mock MCP server fixture returns a
      `tools/list` containing one good tool and one tool with a
      deliberately-malformed `outputSchema`. The good tool renders;
      the bad tool renders with an inline warning badge; a system
      log entry is emitted. No connection failure.
- [ ] **B.1 — Upstream PR draft** at
      `github.com/modelcontextprotocol/typescript-sdk`: wrap the
      per-tool compile in try/catch inside `cacheToolMetadata`,
      log via the SDK's logger interface, skip caching for the
      broken tool, do not throw.
- [ ] **B.2 — When upstream merges:** bump the dep, drop the local
      wrapper, confirm the e2e test still catches the same scenario.

## Falsifier

- A user connects to a server with one bad-schema tool and gets _no_
  tools (current behaviour). Fix is a no-op.
- A user connects to a server with one bad-schema tool and gets
  every other tool _plus_ the broken one rendered without any cue
  that something went wrong. Fix is silent — incomplete.
- A `tools/call` to a tool with a downgraded output validator
  succeeds at the protocol layer but the form's _input_-validation
  is also affected. Wrong scope — input validation is independent
  and must keep working.

## Linked

- The reported tool list contains `brave-brave_image_search` whose
  `outputSchema` is the trigger; capturing it under
  `tests/fixtures/output-schema-bug/brave-image-search.json` will
  let the e2e test reproduce the exact failure (when the un-
  truncated Ajv error is in hand we add a unit test for the
  specific keyword too).

**Advisor sign-off.** Pending — spec purist on the
"silent-downgrade-with-warning" framing, and a security check that
the permissive fallback validator can't be tricked into hiding a
real protocol-level mismatch.

**Status.** **Open.** Target release: v1.1.3 (alongside DEC-015).
Blocked on Costa's choice of A / B / C.
