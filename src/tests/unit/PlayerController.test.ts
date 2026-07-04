import { describe, expect, it } from "vitest";
import { EventBus } from "../../game/EventBus";
import {
  PlayerController,
  type GroundReport,
  type InputFrame,
  type PlayerEvents,
} from "../../game/player/PlayerController";

const emptyInputFrame: InputFrame = Object.freeze({
  moveX: 0,
  moveY: 0,
  sprintHeld: false,
  jumpPressed: false,
  jumpHeld: false,
  dashPressed: false,
  dashHeld: false,
});

const groundedReport: GroundReport = Object.freeze({
  grounded: true,
  slopeDegrees: 0,
  groundNormal: { x: 0, y: 1, z: 0 },
});

const airborneReport: GroundReport = Object.freeze({
  grounded: false,
  slopeDegrees: 0,
  groundNormal: { x: 0, y: 1, z: 0 },
});

describe("PlayerController", () => {
  it("fires a buffered jump once and not repeatedly", () => {
    const events = new EventBus<PlayerEvents>();
    let jumps = 0;
    events.subscribe("player/jumped", () => {
      jumps += 1;
    });
    const controller = new PlayerController({ events });

    controller.update(0.016, { ...emptyInputFrame, jumpPressed: true, jumpHeld: true }, 0, airborneReport);
    controller.reconcilePosition({ x: 0, y: 0.5, z: 0 }, airborneReport);
    controller.update(0.05, emptyInputFrame, 0, groundedReport);
    controller.reconcilePosition({ x: 0, y: 0.5, z: 0 }, airborneReport);
    controller.update(0.016, emptyInputFrame, 0, airborneReport);

    expect(jumps).toBe(1);
  });

  it("tracks dash duration and cooldown readiness", () => {
    const events = new EventBus<PlayerEvents>();
    let dashStarted = 0;
    let dashReady = 0;
    events.subscribe("player/dashStarted", () => {
      dashStarted += 1;
    });
    events.subscribe("player/dashReady", () => {
      dashReady += 1;
    });
    const controller = new PlayerController({ events });

    controller.update(
      0.016,
      { ...emptyInputFrame, moveY: 1, dashPressed: true, dashHeld: true },
      0,
      groundedReport,
    );
    expect(controller.getDebugSnapshot().state).toBe("Dashing");
    expect(dashStarted).toBe(1);
    expect(controller.getDebugSnapshot().dashCooldownRemaining).toBeGreaterThan(1);

    controller.update(0.2, emptyInputFrame, 0, groundedReport);
    controller.reconcilePosition({ x: 0, y: 0, z: 0 }, groundedReport);
    expect(controller.getDebugSnapshot().state).toBe("Grounded");
    expect(dashReady).toBe(0);

    controller.update(1.4, emptyInputFrame, 0, groundedReport);
    expect(controller.getDebugSnapshot().dashCooldownRemaining).toBe(0);
    expect(dashReady).toBe(1);
  });
});
