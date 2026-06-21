# FE Task Template

Use this template when assigning work to an AI agent in VietRide.

## Goal

What should change from the user's perspective?

## Scope

Files, modules, pages, or flows the agent is allowed to touch.

## Acceptance Criteria

- What must work when the task is done?
- What UI states, responsive sizes, or edge cases must be checked?
- What behavior must not regress?

## Do Not Touch

Files, modules, flows, or refactors that are explicitly out of scope.

## Validation

Default:

```bash
npm run lint
npm run build
```

For UI work, also verify in browser with desktop and mobile viewport screenshots.

## Notes

Relevant context, screenshots, API shapes, product constraints, or design links.
