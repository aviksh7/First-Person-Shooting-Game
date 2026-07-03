# NULLPOINT

Professional browser-first FPS vertical slice foundation. Sprint 0 is technical groundwork only: no weapons, enemies, combat, missions, progression, multiplayer, skins, or monetization.

## Stack

- Vite
- TypeScript strict mode
- Babylon.js 8 through `@babylonjs/core`
- React 18 for DOM overlay UI only
- Zustand for the game-to-UI bridge
- Zod for content validation
- localforage reserved for future save storage
- ESLint, Prettier, Vitest, Playwright
- Node 22 and npm

## Folder Responsibilities

- `src/engine`: Babylon scene setup, render loop, fixed-timestep loop, input, pointer lock, asset manifest loader stub, performance stats. This is the only folder allowed to import `@babylonjs/*`.
- `src/game`: state machine, event bus, and core phase definitions. No Babylon imports.
- `src/bridge`: Zustand stores, typed UI commands, runtime assembly, and future save-storage bridge. No Babylon imports.
- `src/ui`: React overlay screens and DOM-only UI. No Babylon imports.
- `src/content`: Zod-validated placeholder content schemas. No gameplay content yet.
- `src/tests`: Vitest unit tests and Playwright smoke tests.

## Architecture Boundaries

- Phase changes go through `GameStateMachine`.
- React UI sends intent through `UiCommands`; it does not mutate engine internals.
- Scene code does not directly control React UI.
- Game and bridge layers must not import from Babylon.
- ESLint enforces the Babylon boundary with `no-restricted-imports`.

## TypeScript Rules

- Keep `strict` and `noImplicitAny` enabled.
- Avoid `any`, `@ts-ignore`, and silent strictness disables.
- Prefer typed interfaces at boundaries.

## Performance Budget

- Target desktop/laptop browsers and Chromebook-level devices.
- Simulation tick target is 60 Hz.
- Render and simulation are decoupled with capped catch-up steps.
- No shadows in Sprint 0.
- Avoid new runtime libraries unless they are clearly justified.

## Commands

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run format`

## Deployment

GitHub Pages deployment is not configured yet. Remaining setup: choose the repository Pages source, set Vite `base` if deploying under a project path, and add a deploy job after CI passes.
