import { create } from "zustand";
import type { PerfStats } from "../engine/PerformanceStats";
import type { GamePhase } from "../game/GamePhase";
import type { PlayerDebugSnapshot } from "../game/player/PlayerController";

interface UiStore {
  readonly phase: GamePhase;
  readonly perfStats: PerfStats;
  readonly playerDebug: PlayerDebugSnapshot | null;
  readonly isPerfOverlayVisible: boolean;
  readonly setPhase: (phase: GamePhase) => void;
  readonly setPerfStats: (stats: PerfStats) => void;
  readonly setPlayerDebug: (snapshot: PlayerDebugSnapshot) => void;
  readonly togglePerfOverlay: () => void;
}

export const useUiStore = create<UiStore>()((set) => ({
  phase: "Boot",
  perfStats: {
    fps: 0,
    drawCalls: 0,
  },
  playerDebug: null,
  isPerfOverlayVisible: false,
  setPhase: (phase) => set({ phase }),
  setPerfStats: (perfStats) => set({ perfStats }),
  setPlayerDebug: (playerDebug) => set({ playerDebug }),
  togglePerfOverlay: () =>
    set((state) => ({
      isPerfOverlayVisible: !state.isPerfOverlayVisible,
    })),
}));
