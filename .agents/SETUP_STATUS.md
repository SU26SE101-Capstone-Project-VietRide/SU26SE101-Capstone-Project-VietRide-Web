# VietRide AI Setup Status

Last updated: 2026-06-21

## Completed

- Added root `AGENTS.md` as the project-level AI operating guide.
- Added `.agents/` workflow docs:
  - `FE_TASK_TEMPLATE.md`
  - `WORKFLOW.md`
  - `PROMPTS.md`
  - `CHECKLISTS.md`
- Added `.mcp.json` with CodeGraph MCP configuration.
- Initialized CodeGraph for this workspace.
- Indexed current source code.
- Added `npm run typecheck`.
- Added Vitest + React Testing Library test setup.
- Added smoke tests for shared `Modal` and `vehicleStore`.
- Brought baseline validation to green.

## CodeGraph Status

Current status:

```txt
Files: 53
Nodes: 821
Edges: 1,480
DB Size: 1.90 MB
Backend: node:sqlite - built-in (full WAL)
Status: Index is up to date
```

Useful commands:

```bash
npx @colbymchenry/codegraph status
npx @colbymchenry/codegraph index .
npx @colbymchenry/codegraph mcp
```

Note: CodeGraph stores local database files in `.codegraph/`. The generated
database is machine-local and should not be committed.

## Manual Next Steps

### Ponytail

Install in Codex/Claude Code when plugin marketplace access is available:

```txt
/plugin marketplace add DietrichGebert/ponytail
```

Use Ponytail as the decision/minimalism layer described in `AGENTS.md`.

### Superpower

Import prompt chains from `.agents/PROMPTS.md`.

Recommended settings:

```txt
Language: Vietnamese for explanations / English for code and comments
Tone: Technical, concise
Auto-folder: FE Dev / VietRide
```

### React Best Practices

If a Vercel React Best Practices skill/plugin becomes available, use it as a
reference layer only. Do not let Next.js-specific guidance override this
React + Vite project's local conventions.

## Recommended Next Setup Phase

1. Add Storybook when shared components under `src/components/` become stable.
2. Add Playwright smoke tests for login, dashboard navigation, and
   vehicle-builder flows.
3. Add MSW only when real API integration begins.

## Baseline Validation

Last verified:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Result: all passed.

Build note: Vite reports a large client chunk after minification. Treat this as
a future performance/code-splitting follow-up, not a blocking setup issue.
