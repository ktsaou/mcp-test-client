---
name: project-coding
description: TypeScript / React 19 / Mantine v9 coding conventions for the mcp-test-client project, derived from observed patterns. MUST be followed for all code changes in this repo.
---

# project-coding

## Languages and frameworks

Versions pinned in `package.json`:

- Node.js `>=20`, TypeScript `^6.0.3`, React `19.2.5`, React DOM `19.2.5`
- `@mantine/core` `^9.1.0` + `@mantine/{hooks,modals,notifications,spotlight}` `^9.1.0`
- Vite `^8.0.10` (build + dev), Vitest `^4.1.5` (unit), `@playwright/test` `^1.59.1` (e2e)
- `@modelcontextprotocol/sdk` `1.29.0` (deep imports only — see ESLint rule below)
- `zod` `4.3.6`, `cmdk` `^1.1.1`, `gpt-tokenizer` `^3.4.0`, `nanoid` `5.1.7`,
  `@cfworker/json-schema` `^4.1.1`, `react-resizable-panels` `^4.10.0`

## TypeScript settings

From `tsconfig.app.json`. All strict-family flags are on:

- `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
  `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`
- `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `lib: [ES2023, DOM, DOM.Iterable]`
- `jsx: react-jsx` — never write `import React`; JSX runtime is automatic
- `allowImportingTsExtensions: true` — imports MUST include the `.ts` / `.tsx` extension
  (e.g. `import { App } from './App.tsx'`); see every import in `src/main.tsx`
- `verbatimModuleSyntax: true` — type-only imports must use `import type { … }`
- `isolatedModules: true`, `moduleDetection: force`, `noEmit: true`
- Project references split: `tsconfig.app.json` (src), `tsconfig.node.json`, `tsconfig.test.json`
- Tests are excluded from the app program: `"exclude": ["src/**/*.test.*", "src/**/*.spec.*"]`

## Code style and formatting

Prettier (`.prettierrc.json`):

- 100-col print width, 2-space indent, single quotes, trailing commas everywhere,
  semicolons, LF line endings, `arrowParens: always`, `bracketSpacing: true`

ESLint flat config (`eslint.config.mjs`):

- `js.configs.recommended` + `tseslint.configs.recommendedTypeChecked` (typed linting on)
- `eslint-plugin-react` flat recommended + `jsx-runtime` (no React import needed)
- `eslint-plugin-react-hooks`: `rules-of-hooks: error`, `exhaustive-deps: warn`
- `react/no-danger: error` — raw-HTML injection is forbidden (specs/security.md §3)
- `@typescript-eslint/no-unused-vars: error` with `argsIgnorePattern`/`varsIgnorePattern: '^_'`
  — prefix unused names with `_` (e.g. `_event`)
- `no-restricted-imports` blocks:
  - `@modelcontextprotocol/sdk/client/stdio.js` (Node-only — would break browser builds)
  - `@modelcontextprotocol/sdk` bare (use deep imports per `src/README.md`)
- Test files relax `no-explicit-any`, `require-await`, `no-unnecessary-type-assertion`

## Naming conventions

Observed in `src/`:

- Files: kebab-case — `log-panel.tsx`, `metrics-chips.tsx`, `log-headline.ts`, `connection.tsx`
- React components: PascalCase functions (`function LogPanel()`, `function MetricsChips({…})`)
- Hooks: camelCase prefixed `use*` — `useConnection`, `useLog`, `useServers`, `useTheme`
- Pure utilities: camelCase functions — `formatHeadline`, `formatBytes`, `headlineForRequest`
- Type/interface exports: PascalCase — `Headline`, `ResponseMetrics`, `ConnectionStatus`
- Discriminated unions: `{ state: 'idle' } | { state: 'connecting' } | …` (see `ConnectionStatus`)
- Tests co-located: `App.test.tsx`, `url-state.test.ts` next to the file under test

## Module layout

Top-level under `src/`:

- `src/state/` — React Context providers + consumer hooks (`connection.tsx`, `log.tsx`,
  `servers.tsx`, `selection.tsx`, `theme.tsx`, `request-actions.tsx`, `sidebar-collapse.tsx`)
  plus pure helpers (`store-instance.ts`, `url-state.ts`, `url-boot-snapshot.ts`,
  `tool-state-persistence.ts`)
- `src/ui/` — Components, pure UI helpers, co-located CSS (`log-panel.tsx` + `log-panel.css`,
  `theme.css`, `shell.css`, `json-view.css`, `command-palette.css`)
- `src/mcp/` — MCP client integration + project-local types (`types.ts` re-exports
  `JSONRPCMessage` from the SDK)
- `src/persistence/` — localStorage schema, migrations, store
- `src/schema-form/` — JSON Schema → React form renderer (with its own `schema-form.css`)
- `src/share-url/` — URL hash encoder/decoder
- `src/catalog/` — public-server catalog loader
- `src/diagnostics/` — diagnostic-bundle reporter (token redaction)

## Common patterns

Cite-by-example; mirror the closest existing file when in doubt:

- **Function components only.** No class components anywhere.
- **State management = React Context.** No Redux, no Zustand. Each domain owns one
  Provider + one consumer hook. Pattern (see `src/state/connection.tsx`):
  ```ts
  const Ctx = createContext<Value | null>(null);
  export function FooProvider({ children }) { /* … */ return <Ctx.Provider value={…}>{children}</Ctx.Provider>; }
  export function useFoo(): Value {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useFoo must be used inside <FooProvider>');
    return ctx;
  }
  ```
- **Provider tree** is composed in `src/App.tsx` (`Theme → Mantine → SidebarCollapse → Servers → Log → Connection → Selection → RequestActions → CommandPaletteHost`).
- **Async + race guards.** `useCallback` wraps async funcs; `useRef` holds monotonic
  epoch counters to detect superseded in-flight calls (see `connectEpochRef` in
  `src/state/connection.tsx`).
- **Fire-and-forget cleanup**: `void promise.catch(() => undefined)` (e.g. previous
  client disconnect on a new connect).
- **Mantine for all UI primitives** — `Button`, `Modal`, `Tooltip`, `ActionIcon`, `Badge`,
  `Pill`, `Text`, `Box`, `ScrollArea`, `Group`, `Stack`, `Menu`, `MantineProvider`,
  `ModalsProvider`, `Notifications` (`@mantine/notifications`), `Spotlight`.
- **CSS co-located** with the component; imported once in `src/main.tsx` after Mantine's
  own `styles.css` so theme overrides win.
- **Pure helpers separated from React** — `src/ui/log-headline.ts` is React-free so it
  can be unit-tested without a DOM.
- **Type guards before message access** — `if (!('method' in message) || typeof message.method !== 'string')`.
- **Comments explain WHY**, not WHAT. Reference DEC numbers for non-obvious decisions
  (`// DEC-014: chip-fold ladder`, `// DEC-026 — apply the boot URL state`, `// DEC-029`).
- **DEC-005 bundle budget** — initial bundle ≤ 350 KB gz; `npm run check:bundle` runs
  before ship.
- **Diagnostics global** — `window.mcpClientDiagnostics = () => snapshotBundle()` exposed
  in `src/main.tsx` for users reporting bugs from DevTools.

## Things to avoid

- `import React from 'react'` — `jsx: react-jsx` makes it unnecessary
- Default exports for components — use **named** exports (every component in `src/`)
- Direct `@modelcontextprotocol/sdk/client/stdio.js` import — ESLint blocks it
- Bare `@modelcontextprotocol/sdk` imports — use deep imports per ESLint `no-restricted-imports`
- Raw-HTML injection via React's `dangerously*` escape hatch — `react/no-danger: error`
- Direct `localStorage.*` access — go through `appStore` (`src/state/store-instance.ts`)
- Class components, Redux, external state libs
- Native HTML `title=` on log rows or interactive elements — DEC-029 mandates Mantine
  `<Tooltip>` as the only acceptable mechanism
- Imports without the `.ts` / `.tsx` extension — required by `allowImportingTsExtensions`

## Build / lint / test commands

From `package.json` scripts:

- `npm run dev` — Vite dev server (port 5173, `strictPort: false`)
- `npm run build` — `tsc -b && vite build && cp -r docs specs dist/`
- `npm run typecheck` — `tsc -b --noEmit`
- `npm run lint` — `eslint . && prettier --check .`
- `npm run lint:fix` — `eslint . --fix && prettier --write .`
- `npm test` — `vitest run` (one-shot)
- `npm run test:watch`, `npm run test:coverage` (`@vitest/coverage-v8`)
- `npm run test:e2e` — Playwright (`test:e2e:install` for first-time setup)
- `npm run check:bundle` — DEC-005 350 KB gz cap (`scripts/bundle-budget.mjs`)
- `npm run clean` — wipes `dist coverage playwright-report test-results`

## How to write code that fits

1. Read the closest existing file in the same `src/<dir>/` and mirror its shape,
   imports, and comment style.
2. Use Mantine primitives for any UI surface. New raw `<div>` chrome should be a red flag.
3. New domain state → add a Provider in `src/state/` + a `use<Name>` consumer hook;
   compose it into the tree in `src/App.tsx`.
4. Pure logic → extract React-free helpers (e.g. `src/ui/log-headline.ts`) so tests
   stay DOM-free.
5. Visible-surface changes require a UX-critic pass before ship — see
   `project-reviewing` skill.
6. Non-obvious design choices: write a DEC under `.agents/sow/specs/decisions/DEC-NNN-*.md`
   BEFORE the code, then reference the DEC number in the inline comment.
