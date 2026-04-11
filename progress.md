Original prompt: PLEASE IMPLEMENT THIS PLAN:

# Browser-First 3D FPS V1 Plan

Initial notes:
- Fresh workspace; project is being scaffolded from scratch.
- Goal is a substantial browser-first FPS, not a tiny arena demo.
- First implementation pass will prioritize a complete playable loop with campaign, survival, loadouts, progression, settings, saves, and deterministic hooks.

TODOs:
- Finish gameplay runtime and Babylon scene generation.
- Wire menu actions to runtime lifecycle.
- Validate persistence, progression rewards, and attachment stat application.
- Add Playwright smoke coverage and inspect the gameplay screenshot output.

Implemented:
- Vite + TypeScript + React + Babylon.js project scaffold with the planned folder layout.
- Data-driven content definitions for 4 campaign missions, 3 survival maps, 6 weapons, 4 equipment items, 12 attachments, 7 enemy/boss definitions, progression, and achievements.
- Playable graybox FPS runtime with campaign and survival entry points, loadouts, attachment stat modifiers, enemy AI, objectives, save slots, autosave, settings, gore toggle, and mission debrief flow.
- Deterministic browser hooks: `window.render_game_to_text`, `window.advanceTime`, and a local Playwright gameplay client for screenshot/state validation.
- Visual validation pass: `output/web-game/shot-0.png` now shows an actual combat lane and enemy presence with no browser errors in the final smoke run.
- Formal verification: `npm run build` passes and `npx playwright test src/tests/e2e/smoke.spec.ts --reporter=line` passes.

Remaining improvements:
- Audio is still placeholder-level; Howler is installed but not yet driving a full SFX/music pass.
- Mission scripting and survival wave pacing are functional but still graybox and balance-first rather than content-final.
- The production JS bundle is large because Babylon is still loaded eagerly; future code-splitting and asset streaming would help.
