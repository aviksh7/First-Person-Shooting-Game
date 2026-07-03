import { describe, expect, it } from "vitest";
import { GameStateMachine } from "../../game/GameStateMachine";

describe("GameStateMachine", () => {
  it("supports the Sprint 0 phase path", () => {
    const stateMachine = new GameStateMachine();

    expect(stateMachine.phase).toBe("Boot");
    expect(stateMachine.transition("Menu")).toBe("Menu");
    expect(stateMachine.transition("Playing")).toBe("Playing");
    expect(stateMachine.transition("Paused")).toBe("Paused");
    expect(stateMachine.transition("Playing")).toBe("Playing");
  });

  it("rejects invalid transitions", () => {
    const stateMachine = new GameStateMachine();

    expect(() => stateMachine.transition("Playing")).toThrow("Boot -> Playing");
    expect(stateMachine.transition("Menu")).toBe("Menu");
    expect(() => stateMachine.transition("Paused")).toThrow("Menu -> Paused");
  });
});
