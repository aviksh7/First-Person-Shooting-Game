import { create } from "zustand";
import type { PerfStats } from "../engine/PerformanceStats";
import type { GamePhase } from "../game/GamePhase";

interface UiStore {
  readonly phase: GamePhase;
  readonly perfStats: PerfStats;
  readonly isPerfOverlayVisible: boolean;
  readonly setPhase: (phase: GamePhase) => void;
  readonly setPerfStats: (stats: PerfStats) => void;
  readonly togglePerfOverlay: () => void;
}

export const useUiStore = create<UiStore>()((set) => ({
  phase: "Boot",
  perfStats: {
    fps: 0,
    drawCalls: 0,
  },
  isPerfOverlayVisible: false,
  setPhase: (phase) => set({ phase }),
  setPerfStats: (perfStats) => set({ perfStats }),
  togglePerfOverlay: () =>
    set((state) => ({
      isPerfOverlayVisible: !state.isPerfOverlayVisible,
    })),
}));
