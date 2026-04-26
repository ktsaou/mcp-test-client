---
name: project-testing
description: Test framework, fixtures, and patterns for the mcp-test-client project. MUST be followed for any test work in this repo.
---

# project-testing

How testing actually works in this codebase. Cite this skill from the
SOW Test step. If a pattern below doesn't fit a new test, document the
divergence in the SOW and update this skill in step 11.

## Test stack (versions from `package.json`)

- **Vitest 4.1.5** — unit + component runner (`vitest run` / `vitest`)
- **@vitest/coverage-v8 4.1.5** — coverage provider
- **happy-dom 20.9** — DOM env for vitest (set in `vitest.config.ts:8`)
- **jsdom 29.0** — installed as fallback; not the default env
- **@testing-library/react 16.3** + **/jest-dom 6.6** + **/user-event 14.6** + **/dom 10.4**
- **Playwright 1.59** (`@playwright/test`) — e2e on **Chromium only**.
  Firefox + WebKit projects are declared but `testIgnore: /.*/` (see
  `playwright.config.ts:30,34`) — opt in with `--project=firefox|webkit`
  if a test asks for it.
- **MSW**: not installed. Do not introduce it without a DEC.

## Test layout

- **Co-located unit / component**: `src/foo/bar.tsx` → `src/foo/bar.test.tsx`
  (or `.test.ts` for pure helpers). Vitest discovers
  `src/**/*.{test,spec}.{ts,tsx}` (`vitest.config.ts:11`).
- **Conformance / compliance**: `tests/conformance/**/*` and
  `tests/compliance/**/*` — MCP wire-spec tests; same vitest runner
  (`vitest.config.ts:13-14`).
- **e2e**: `tests/e2e/*.spec.ts` — Playwright. Excluded from vitest
  discovery (`vitest.config.ts:16`).
- **Fixtures**: `tests/fixtures/mock-mcp-server/run.ts` — Node mock MCP
  server on port 4321, started via `node --experimental-strip-types` and
  spawned automatically by Playwright's `webServer` (`playwright.config.ts:47-55`).
- **Vitest setup**: `tests/setup/vitest.setup.ts` — runs once per file
  (`vitest.config.ts:9`); installs jest-dom matchers + browser-API stubs.

## Fixture and mock patterns

### Storage polyfill (mandatory)

happy-dom + jsdom in vitest 4 don't reliably expose `window.localStorage`.
The setup file installs a `MemoryLocalStorage` class
(`tests/setup/vitest.setup.ts:9-43`). Persistence-layer tests use a
separate `MemoryStorage` exported from
`src/persistence/store.test.ts:6-46` (note: the test file exports a
helper that other tests import — this is the canonical pattern).

For component tests that touch the persistence store, swap the live
storage via the test hook:

```ts
import { __setStorageForTests } from '../state/store-instance.ts';
import { MemoryStorage } from '../persistence/store.test.ts';

beforeEach(() => {
  __setStorageForTests(new MemoryStorage());
});
```

(see `src/ui/log-panel.test.tsx:17-39`)

### Browser-API stubs (already installed in setup)

The setup file polyfills three Mantine dependencies that happy-dom
lacks (`tests/setup/vitest.setup.ts:44-87`): `document.fonts`,
`ResizeObserver`, `window.matchMedia`. Do not re-stub these per-test.

### Mantine wrapping (mandatory for any component test)

Every component test wraps the tree in `<MantineProvider>` +
`<Notifications/>`. Components fail at render with cryptic `useTheme`
errors otherwise. Reference: `src/ui/log-panel.test.tsx:20-27`. Use a
local `Wrapper` component or a `renderWithMantine()` helper at the top
of the file.

### TestDriver pattern (for stateful components)

For components that consume context (e.g. `useLog()`), embed a
`<TestDriver onReady={...}>` child that captures the context API into a
ref, so the test can drive state imperatively via `act()`:

```tsx
function TestDriver({ onReady }: { onReady: (ctx: ReturnType<typeof useLog>) => void }) {
  const ctx = useLog();
  onReady(ctx);
  return null;
}
```

(see `src/ui/log-panel.test.tsx:29-56`). Then `act(() => h.api.appendWire(...))`
in the test body to push events into the component without a real
network round-trip.

### Mock MCP server

`tests/fixtures/mock-mcp-server/run.ts` is the e2e fixture. It exposes
two tools (`echo`, `add`) on `http://127.0.0.1:4321/mcp` with a
`/health` endpoint Playwright polls. Do **not** mock the MCP SDK
itself — the SDK's surface is large and brittle to mock. Real fixture +
real wire = test signal that survives SDK upgrades.

## Coverage

- v8 provider; reporters `text` + `html` + `lcov` (`vitest.config.ts:18-19`)
- Include: `src/**/*.{ts,tsx}`; exclude: test files, `src/main.tsx`,
  `*.d.ts` (`vitest.config.ts:20-21`)
- **No threshold gating.** Coverage is informational. Treat tests as
  evidence-for-behaviour, not as a percentage target.

## Run commands (`package.json:26-30`)

- `npm test` — vitest single run (CI mode); the SOW Test step runs this
- `npm run test:watch` — vitest in watch mode
- `npm run test:coverage` — vitest + v8 coverage report
- `npm run test:e2e` — Playwright; auto-spawns dev server on :5173 + mock
  MCP on :4321 (`playwright.config.ts:39-56`)
- `npm run test:e2e:install` — `playwright install --with-deps` (first run)

## Real-use validation (the SOW DoD #2 gate)

`.agents/skills/project-maintainer/release-readiness.md` makes "you used it for real"
non-negotiable. For SOW Validation evidence, this project has **two**
acceptable proofs and one disqualified proof:

1. **Headless playwright on the LIVE deploy** — `https://ktsaou.github.io/mcp-test-client/`.
   Spawn a UX-critic agent with `mcp__playwright_headless__*` tools
   (note: brief the critic to use `_evaluate` + `_snapshot` for evidence,
   not `_take_screenshot` — the screenshot pipeline has had API-400
   failures in the past, see `feedback-folding.md` DEC-029 lesson).
2. **Costa-direct verification** — Costa runs the live deploy himself
   and confirms. Strongest possible signal; supersedes the headless
   critic gate.
3. **Localhost validation does NOT count** for ship-grade real-use
   evidence. The deploy pipeline can fail / cancel-chain, and a local
   dev build can pass while the live deploy is stale (the
   "six-release-bender" lesson, `feedback-folding.md` 2026-04-26).

After tagging, also `curl` the deployed `index-*.js` filename or check
GH Pages workflow status before claiming "shipped".

## Test patterns to mirror

- **Pure helper** — `src/ui/log-headline.test.ts`. `describe` per public
  function, `it.each([...])` for table-driven cases, no DOM, no Mantine.
- **Component with state** — `src/ui/log-panel.test.tsx`. Wrapper +
  TestDriver + `act()` to drive events; `screen.getByLabelText` /
  `getByRole` for assertions; `within(row)` to scope per-row queries.
- **Persistence / storage** — `src/persistence/store.test.ts`. Uses
  `MemoryStorage` (exported from this same file), `vi.fn()` for error
  sinks, `failNextWrite()` test hook to simulate quota errors.
- **e2e smoke** — `tests/e2e/smoke.spec.ts`. `beforeEach` clears
  `localStorage` and reloads; matches by **placeholder** not label
  (Mantine renders required-field labels with " \*" suffix); waits up to
  15 s for the MCP handshake.
- **e2e visual / layout invariant** — `tests/e2e/log-row-alignment.spec.ts`.
  Uses `getBoundingClientRect()` evaluated in the page context across
  multiple viewport widths; defines an explicit `assertAligned()` helper
  with a tolerance constant; verifies a DEC's named falsifier
  (DEC-014's right-edge alignment under squeeze).

## Things to avoid

- **Don't mock the MCP SDK.** Use the real mock server fixture.
- **Don't skip Mantine wrapping.** Components fail with `useTheme`
  errors at render.
- **Don't introduce MSW.** Not installed; the fixture-server pattern is
  the chosen path.
- **Don't pursue coverage thresholds.** No gates; chasing % is busywork.
- **Don't use localhost as ship evidence.** Critic must verify the live
  deploy.
- **Don't silence diagnostics to fix a perception bug.** When a user
  reports confusion alongside diagnostic data, the fix is clearer
  framing — not muting the signal (`feedback-folding.md` 2026-04-25
  Ajv-silencing lesson; the global memory entry on this echoes the same
  rule).
- **Don't enable Firefox / WebKit projects** without a DEC. They're
  `testIgnore`'d for a stated reason (browser-specific locator quirks).
- **Don't match Mantine labels by name** in e2e — match by placeholder
  (Mantine appends ` *` to required labels). See `smoke.spec.ts:18`.

## When to add a test

- **Every new behaviour**: a unit test or e2e step (or both, if the
  visible surface matters).
- **Every regression**: a regression test BEFORE the fix; it must fail
  on the pre-fix tree and pass after the fix. The SOW regression flow
  in `~/.agents/skills/sow/sow-regression.md` requires this.
- **Every DEC with a named falsifier**: an e2e or unit test that
  exercises that falsifier where automatable. `log-row-alignment.spec.ts`
  is the model — the DEC's falsifier becomes the test's assertion
  message.

## Lessons Learnt

(Append `date — what happened — guardrail` rows here as testing-related
issues surface. Empty until the first lesson is folded in.)
