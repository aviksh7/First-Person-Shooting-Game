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
    __NULLPOINT_RUNTIME_DISPOSE__?: () => void;
  }
}

export function createNullpointRuntime(canvas: HTMLCanvasElement): NullpointRuntime {
  window.__NULLPOINT_RUNTIME_DISPOSE__?.();

  const events = new EventBus<RuntimeEvents>();
  const stateMachine = new GameStateMachine();
  let isDisposed = false;

  const transitionTo = (phase: GamePhase): void => {
    stateMachine.transition(phase);
    useUiStore.getState().setPhase(stateMachine.phase);
    window.__NULLPOINT_PHASE__ = stateMachine.phase;
    events.emit("phaseChanged", stateMachine.phase);
  };

  const handlePauseRequest = (): void => {
    if (stateMachine.phase !== "Playing") {
      engine.releasePointerLock();
      return;
    }

    engine.setPlaying(false);
    engine.releasePointerLock();
    transitionTo("Paused");
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
    onPlayerDebug: (snapshot) => {
      useUiStore.getState().setPlayerDebug(snapshot);
    },
  });

  const commands: UiCommands = {
    requestPlay: async () => {
      await engine.requestPointerLock();
      await engine.start();
      engine.setPlaying(true);
      if (stateMachine.phase !== "Playing") {
        transitionTo("Playing");
      }
    },
    requestResume: async () => {
      await engine.requestPointerLock();
      engine.setPlaying(true);
      if (stateMachine.phase === "Paused") {
        transitionTo("Playing");
      }
    },
    requestPause: handlePauseRequest,
    togglePerfOverlay: () => {
      useUiStore.getState().togglePerfOverlay();
    },
  };

  transitionTo("Menu");

  const disposeRuntime = (): void => {
    if (isDisposed) {
      return;
    }

    isDisposed = true;
    engine.dispose();
    if (window.__NULLPOINT_RUNTIME_DISPOSE__ === disposeRuntime) {
      delete window.__NULLPOINT_RUNTIME_DISPOSE__;
    }
  };

  window.__NULLPOINT_RUNTIME_DISPOSE__ = disposeRuntime;

  return {
    commands,
    events,
    dispose: disposeRuntime,
  };
}
