# Sprint 1B-A Movement Gym

Sprint 1B-A adds a focused movement gym for exposing controller behavior. It is diagnostic space only: no new movement mechanics, weapons, enemies, missions, saves, art, or audio.

## Zones

- Runway: flat start lane with distance markers for walk, sprint, and jump feel.
- Dash lane: long flat lane for dash distance and grounded overspeed decay.
- Stairs: isolated 0.15m, 0.25m, 0.35m, and 0.5m step tests.
- Ramps: approximate 20 degree, 35 degree, 44 degree, and 55 degree slope tests.
- Gaps: 2.5m, 4.5m, and 6.5m gaps with lower catch pits and exits.
- Drop platforms: 1m, 2m, and 4m drop tests.
- Tight geometry: doorway, corner corridor, and head-bump bar.

## Spawn IDs

- `runway`
- `dash-lane`
- `stairs`
- `ramps`
- `gaps`
- `drops`
- `tight-geometry`

The default spawn is `runway`. In dev builds, `?spawn=<zoneId>` starts at a specific zone. Invalid spawn IDs fall back to `runway`.

## Manual Checklist

- Start from `runway` and confirm W movement, sprint, jump, pause, and F3 debug still work.
- Use `?spawn=dash-lane` and confirm grounded dash overspeed visibly decays after the dash window.
- Use `?spawn=stairs` and try each step height without assuming step-up is supported.
- Use `?spawn=ramps` and compare grounded behavior below and above the configured max slope.
- Use `?spawn=gaps` and check that failed jumps fall into catch pits instead of hiding failure.
- Use `?spawn=drops` and confirm landing state and vertical velocity settle after drops.
- Use `?spawn=tight-geometry` and jump into the head-bump bar; upward velocity should clear within one tick.

## Notes

Airborne dash momentum is intentional in Sprint 1B-A.

Explicit step-up is not implemented yet. The stair zone exists to expose that limitation, not to solve it.
