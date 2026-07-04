import { describe, expect, it } from "vitest";
import { defaultMovementConfig } from "../../game/player/movementConfig";
import {
  accelerateHorizontal,
  applyGroundFriction,
  isSlopeWalkable,
  jumpVelocityFromApex,
  updateCoyoteTimer,
} from "../../game/player/movementMath";

describe("movementMath", () => {
  it("computes a jump velocity that reaches the configured apex height", () => {
    const jumpVelocity = jumpVelocityFromApex(
      defaultMovementConfig.jumpApexHeight,
      defaultMovementConfig.gravity,
    );
    const apexHeight = (jumpVelocity * jumpVelocity) / (2 * defaultMovementConfig.gravity);

    expect(apexHeight).toBeCloseTo(defaultMovementConfig.jumpApexHeight, 5);
  });

  it("keeps coyote time valid at 90 ms and invalid at 150 ms", () => {
    expect(
      updateCoyoteTimer(defaultMovementConfig.coyoteTime, false, 0.09, defaultMovementConfig.coyoteTime),
    ).toBeGreaterThan(0);
    expect(
      updateCoyoteTimer(defaultMovementConfig.coyoteTime, false, 0.15, defaultMovementConfig.coyoteTime),
    ).toBe(0);
  });

  it("classifies 40 degree slopes as walkable and 50 degree slopes as unwalkable", () => {
    expect(isSlopeWalkable(40, defaultMovementConfig.maxSlopeDegrees)).toBe(true);
    expect(isSlopeWalkable(50, defaultMovementConfig.maxSlopeDegrees)).toBe(false);
  });

  it("slows ground movement without reversing direction", () => {
    expect(applyGroundFriction({ x: 1, z: 0 }, defaultMovementConfig.groundFriction, 0.1)).toEqual({
      x: 0,
      z: 0,
    });
  });

  it("accelerates toward target speed without badly overshooting", () => {
    const velocity = accelerateHorizontal(
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      defaultMovementConfig.walkSpeed,
      defaultMovementConfig.groundAcceleration,
      0.5,
    );
    const secondVelocity = accelerateHorizontal(
      velocity,
      { x: 1, z: 0 },
      defaultMovementConfig.walkSpeed,
      defaultMovementConfig.groundAcceleration,
      0.5,
    );

    expect(velocity.x).toBeCloseTo(defaultMovementConfig.walkSpeed, 5);
    expect(secondVelocity.x).toBeCloseTo(defaultMovementConfig.walkSpeed, 5);
  });
});
