# VietRide AI Prompt Chains

Use these prompt chains in Superpower or copy them into Codex/Claude tasks.

## UI Component Build

```md
Goal:
Build or update [component/section] for [page/flow].

Workflow:
1. Read AGENTS.md.
2. Find existing similar components and local UI patterns.
3. Apply Ponytail: reuse existing component/props before creating a new one.
4. If creating shared UI under src/components, add story if Storybook exists.
5. Keep feature-only components module/page-scoped.
6. Validate with lint/build and browser screenshot for desktop/mobile.

Acceptance:
- Matches surrounding Tailwind style.
- No overflow/clipping on desktop/mobile.
- Accessible semantic controls.
- No new dependency unless explicitly approved.
```

## Bug Fix

```md
Goal:
Fix [bug] in [page/module/flow].

Workflow:
1. Trace the call path around the bug.
2. Read source and answer the three verification questions.
3. Identify root cause, not only the symptom.
4. Apply the smallest bounded fix.
5. If a legacy any is in the touched file, fix it only if local and bounded.
6. Add/update regression test if test setup exists.
7. Validate with lint/build and relevant manual/browser verification.

Do Not Touch:
- Unrelated refactors.
- New dependencies.
- Public API shape unless the conflict is reported first.
```

## Refactor

```md
Goal:
Refactor [target] to improve [specific reason].

Workflow:
1. Use CodeGraph when available to find callers/importers.
2. Read the implementation and relevant direct callers.
3. Confirm the refactor is inside scope and behavior-preserving.
4. Extract shared code only when there are 2+ use sites.
5. Keep module-specific helpers inside the owning module.
6. Validate all affected flows.

Acceptance:
- Public behavior unchanged.
- No unrelated files touched.
- No duplicate abstraction introduced.
```

## API Integration

```md
Goal:
Integrate [resource/API] into [page/module].

Workflow:
1. Find existing fetch/data patterns first.
2. Use installed dependencies only; do not add TanStack Query/MSW unless already
   configured or explicitly approved.
3. Define minimal TypeScript response types.
4. Keep hook/client code module-scoped unless reused by 2+ modules.
5. Handle loading/empty/error states in the UI.
6. Add MSW handlers only if MSW exists.
7. Validate with lint/build and browser verification.
```

## i18n Update

```md
Goal:
Add or update user-facing text for [page/flow].

Workflow:
1. Check existing i18n namespace and key style.
2. Update both vi and en locale files.
3. Avoid hard-coded user-facing strings when surrounding code uses t().
4. Verify text length in UI, especially Vietnamese labels.
5. Validate with lint/build.

Acceptance:
- No missing translation keys.
- Vietnamese and English both present.
- UI remains aligned with longer text.
```

## Vehicle Builder Task

```md
Goal:
Update vehicle-builder behavior/UI for [specific feature].

Workflow:
1. Keep changes under src/modules/vehicle-builder unless integration requires
   routing/page changes.
2. Read store/types/canvas/components before changing behavior.
3. Preserve layout JSON compatibility unless explicitly changing the format.
4. Use existing Zustand store before adding new state.
5. Verify interactions manually in browser: create vehicle, add/update seats,
   drag/select, save/load if touched.
6. Validate with lint/build.

Do Not Touch:
- Admin/Manager pages outside vehicle-builder integration.
- Global shared abstractions unless used by 2+ modules.
```

## Visual QA

```md
Goal:
Review visual correctness for [page/flow].

Workflow:
1. Run the app.
2. Capture desktop and mobile screenshots.
3. Check spacing, alignment, overflow, clipping, hit targets, and contrast.
4. Check Vietnamese and English text if the page is localized.
5. Report concrete UI issues with file/area references.
```
