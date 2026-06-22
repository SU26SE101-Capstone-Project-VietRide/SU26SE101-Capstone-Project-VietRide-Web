# VietRide AI Workflow

Use this workflow for AI-assisted frontend work in VietRide.

## 1. Intake

Start from `.agents/FE_TASK_TEMPLATE.md` whenever possible.

Minimum task shape:

- Goal
- Scope
- Acceptance Criteria
- Do Not Touch
- Validation

If any of those are missing, infer conservatively from the current task and
repository. Ask only when the missing detail changes scope, public API, or
product behavior.

## 2. Orient

Read `AGENTS.md` first.

For source-code tasks:

- Use CodeGraph first when indexed.
- Use `rg` and direct file reads to verify exact source.
- Identify relevant files, local conventions, import chains, and callers.

Skip source orientation only for tasks that are clearly docs/config-only.
State the reason when skipping.

## 3. Verify

Before reusing or changing a symbol, answer:

1. What does it do?
2. What are its input/output/type boundaries?
3. Does using or changing it trigger a hard constraint?

Read the implementation and relevant direct callers/importers. Expand only
when those three answers are still unclear.

## 4. Decide

Apply the Ponytail ladder:

- Skip work that does not need to exist.
- Prefer stdlib and native browser APIs.
- Use existing dependencies before adding anything.
- Write the smallest readable implementation that matches local conventions.
- Do not extract shared abstractions without a second use site.

For React questions, use React Best Practices as reference guidance, but local
VietRide conventions and `AGENTS.md` constraints win.

## 5. Execute

Keep changes inside the declared scope.

Project-specific defaults:

- Keep module-owned code inside `src/modules/<module>/`.
- Keep page-specific code in `src/pages/Admin` or `src/pages/Manager`.
- Use existing Zustand stores before creating new stores.
- Use Tailwind utilities first.
- Put user-facing text through i18n when the surrounding page already uses i18n.

## 6. Validate

Default checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

For UI work:

- Run the app.
- Verify the affected flow in browser.
- Check desktop and mobile viewport.
- Watch for overflow, clipping, broken navigation, and i18n text length.

If a check cannot run because of sandbox/environment limits, report exactly
what was skipped and why.

## 7. Report

Final response should include:

- What changed
- Files touched
- Validation run or skipped
- Any tradeoff, follow-up, or unresolved risk

Do not claim the task is clean unless all available validation passed.
