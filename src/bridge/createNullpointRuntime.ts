import { GameEngine } from "../engine/GameEngine";
import type { PerfStats } from "../engine/PerformanceStats";
import { EventBus } from "../game/EventBus";
import type { GamePhase } from "../game/GamePhase";
import { GameStateMachine } from "../game/GameStateMachine";
import type { UiCommands } from "./commands";
import "./saveStorage";
import { useUiStore } from "./uiStore";

interface RuntimeEvents {
  readonly phaseChanged: GamePhase;
  readonly perfUpdated: PerfStats;
}

export interface NullpointRuntime {
  readonly commands: UiCommands;
  readonly events: EventBus<RuntimeEvents>;
  readonly dispose: () => void;
}

declare global {
  interface Window {
    __NULLPOINT_PHASE__?: GamePhase;
    __NULLPOINT_STATS__?: PerfStats;
  }
}

export function createNullpointRuntime(canvas: HTMLCanvasElement): NullpointRuntime {
  const events = new EventBus<RuntimeEvents>();
  const stateMachine = new GameStateMachine();

  const transitionTo = (phase: GamePhase): void => {
    stateMachine.transition(phase);
    useUiStore.getState().setPhase(stateMachine.phase);
    window.__NULLPOINT_PHASE__ = stateMachine.phase;
    events.emit("phaseChanged", stateMachine.phase);
  };

  const handlePauseRequest = (): void => {
    engine.releasePointerLock();
    if (stateMachine.phase === "Playing") {
      transitionTo("Paused");
    }
  };

  const engine = new GameEngine(canvas, {
    onPauseRequested: handlePauseRequest,
    onPerfToggleRequested: () => {
      commands.togglePerfOverlay();
    },
    onPerfStats: (stats) => {
      useUiStore.getState().setPerfStats(stats);
      window.__NULLPOINT_STATS__ = stats;
      events.emit("perfUpdated", stats);
    },
  });

  const commands: UiCommands = {
    requestPlay: async () => {
      await engine.start();
      await engine.requestPointerLock();
      if (stateMachine.phase !== "Playing") {
        transitionTo("Playing");
      }
    },
    requestResume: async () => {
      await engine.requestPointerLock();
      if (stateMachine.phase === "Paused") {
        transitionTo("Playing");
      }
    },
    requestPause: handlePauseRequest,
    togglePerfOverlay: () => {
      useUiStore.getState().togglePerfOverlay();
    },
  };

  void engine.start().then(() => {
    transitionTo("Menu");
  });

  return {
    commands,
    events,
    dispose: () => {
      engine.dispose();
    },
  };
}
