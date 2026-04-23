# tests/

Test suites, grouped by intent.

| Directory      | What lives here                                                               |
| -------------- | ----------------------------------------------------------------------------- |
| `unit/`        | Vitest unit tests co-located per module (`src/x.ts` → `unit/x.test.ts`)       |
| `e2e/`         | Playwright specs driving the real app in a browser                            |
| `conformance/` | Schema-rendering conformance against real tool schemas                        |
| `compliance/`  | MCP spec compliance — exercises our client against `fixtures/mock-mcp-server` |
| `fixtures/`    | Shared test fixtures; includes a mock MCP server                              |

## Adding a schema conformance test

When a user reports that a real tool's schema renders poorly:

1. Save the exact `Tool` object from `tools/list` under
   `tests/conformance/real-schemas/<server>-<tool>.json`.
2. Add a test in `tests/conformance/real-schemas.test.ts` that loads the
   schema, renders the form, and asserts the known-good output.
3. If the renderer fails, fix the renderer before accepting the test.

## Adding a compliance test

When a new MCP spec version lands:

1. Read the diff between versions.
2. For every MUST / MUST NOT added, write a test that asserts the client
   behaviour against `fixtures/mock-mcp-server`.
3. Bump `specs/protocol-compliance.md` "Target spec version" line.
4. Run the whole suite; fix anything that goes red.
