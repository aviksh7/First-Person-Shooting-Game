import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { afterEach, describe, expect, it } from "vitest";
import { defaultMovementConfig } from "../game/player/movementConfig";
import { PlayerCollisionBody } from "./PlayerCollisionBody";
import { createGreyboxScene } from "./createGreyboxScene";

describe("PlayerCollisionBody", () => {
  let engine: NullEngine | undefined;

  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });

  it("uses a downward ground probe and snaps descending feet within snap distance", () => {
    engine = new NullEngine();
    const { scene } = createGreyboxScene(engine);
    const body = new PlayerCollisionBody(scene, defaultMovementConfig, { x: 0, y: 0.2, z: 0 });

    expect(body.getGroundReport().grounded).toBe(true);
    expect(body.getFeetPosition().y).toBeCloseTo(0.2, 5);

    const result = body.move({ x: 0, y: -0.02, z: 0 });

    expect(result.groundReport.grounded).toBe(true);
    expect(result.position.y).toBeCloseTo(0, 5);
    expect(body.getFeetPosition().y).toBeCloseTo(0, 5);

    body.dispose();
    scene.dispose();
  });

  it("does not report grounded when scene geometry is outside snap distance", () => {
    engine = new NullEngine();
    const { scene } = createGreyboxScene(engine);
    const body = new PlayerCollisionBody(scene, defaultMovementConfig, {
      x: 0,
      y: defaultMovementConfig.groundSnapDistance + 0.01,
      z: 0,
    });

    expect(body.getGroundReport().grounded).toBe(false);

    body.dispose();
    scene.dispose();
  });
});
