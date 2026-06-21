# VietRide AI Checklists

## Before Coding

- Read `AGENTS.md`.
- Confirm task scope and do-not-touch boundaries.
- Check `package.json` before assuming scripts or dependencies.
- For source tasks, orient with CodeGraph when indexed, then verify with source.
- Identify local conventions in the target file/module.
- Confirm whether the task is docs/config-only, simple, or non-simple.

## Before Creating New Code

- Can this be skipped as YAGNI?
- Can stdlib or a browser API solve it?
- Can an installed dependency solve it?
- Is there an existing component/hook/store/helper to reuse?
- Is a new abstraction shared by 2+ use sites?
- If single-use, is it module/page-scoped and reducing local complexity?

## React Review

- Is state derived when possible?
- Is an effect truly needed?
- Are hooks called unconditionally and at the top level?
- Are event handlers and derived values kept readable?
- Are interactive controls semantic or properly accessible?
- Is performance optimization justified by actual risk?

## TypeScript Review

- No new `any`.
- Prefer `unknown` plus type guard for unsafe external data.
- Avoid over-typing obvious local values.
- If touching legacy `any`, fix only if local and bounded.
- Do not change public API shape without reporting the tradeoff.

## UI Review

- No overflow, clipping, or layout shift.
- Desktop and mobile viewport checked.
- Buttons/inputs have clear focus and disabled states when relevant.
- Icon-only controls have accessible labels/tooltips.
- Vietnamese text length does not break layout.
- Tailwind classes match surrounding style.

## i18n Review

- User-facing text follows surrounding i18n pattern.
- Both `vi` and `en` are updated.
- Key names match existing namespace style.
- No missing interpolation values.
- Long translated strings still fit.

## Vehicle Builder Review

- Changes stay in `src/modules/vehicle-builder` unless integration requires more.
- Store, types, canvas, and component behavior remain aligned.
- Seat drag/select/update flows still work if touched.
- Save/load layout compatibility is preserved unless intentionally changed.
- Existing vehicle state is reused before adding new state.

## Before Final Response

- Summarize what changed.
- Mention files touched.
- Report validation commands and results.
- Report skipped checks with exact reason.
- Call out remaining risks or follow-ups.
