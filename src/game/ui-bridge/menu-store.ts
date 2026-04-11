import { create } from "zustand";
import type { MenuScreen, ModeId } from "../core/types/content";

interface DebriefPayload {
  title: string;
  summary: string;
  rewards: {
    xp: number;
    credits: number;
  };
  stats: Array<{ label: string; value: string }>;
}

interface MenuState {
  screen: MenuScreen;
  activeMode?: ModeId;
  selectedMissionId?: string;
  selectedSurvivalId?: string;
  paused: boolean;
  hasPointerLock: boolean;
  debrief?: DebriefPayload;
  setScreen: (screen: MenuScreen) => void;
  setPaused: (paused: boolean) => void;
  setSelectedMissionId: (missionId?: string) => void;
  setSelectedSurvivalId: (mapId?: string) => void;
  setActiveMode: (mode?: ModeId) => void;
  setPointerLock: (locked: boolean) => void;
  setDebrief: (debrief?: DebriefPayload) => void;
}

export const useMenuStore = create<MenuState>((set) => ({
  screen: "main",
  paused: false,
  hasPointerLock: false,
  setScreen: (screen) => set({ screen }),
  setPaused: (paused) => set({ paused }),
  setSelectedMissionId: (selectedMissionId) => set({ selectedMissionId }),
  setSelectedSurvivalId: (selectedSurvivalId) => set({ selectedSurvivalId }),
  setActiveMode: (activeMode) => set({ activeMode }),
  setPointerLock: (hasPointerLock) => set({ hasPointerLock }),
  setDebrief: (debrief) => set({ debrief }),
}));
