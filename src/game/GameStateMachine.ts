import type { GamePhase } from "./GamePhase";

const validTransitions: Readonly<Record<GamePhase, readonly GamePhase[]>> = {
  Boot: ["Menu"],
  Menu: ["Playing"],
  Playing: ["Paused", "Results"],
  Paused: ["Playing", "Menu"],
  Results: ["Menu"],
};

export class GameStateMachine {
  private currentPhase: GamePhase = "Boot";

  get phase(): GamePhase {
    return this.currentPhase;
  }

  canTransition(nextPhase: GamePhase): boolean {
    return validTransitions[this.currentPhase].includes(nextPhase);
  }

  transition(nextPhase: GamePhase): GamePhase {
    if (!this.canTransition(nextPhase)) {
      throw new Error(`Invalid game phase transition: ${this.currentPhase} -> ${nextPhase}`);
    }

    this.currentPhase = nextPhase;
    return this.currentPhase;
  }
}
