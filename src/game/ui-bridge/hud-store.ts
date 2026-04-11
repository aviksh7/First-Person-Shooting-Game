import { create } from "zustand";
import type { ActiveNotification } from "../core/types/content";

interface HudState {
  visible: boolean;
  missionName: string;
  objective: string;
  modeLabel: string;
  health: number;
  maxHealth: number;
  ammoInMag: number;
  ammoReserve: number;
  weaponName: string;
  fireMode: string;
  tacticalLabel: string;
  lethalLabel: string;
  tacticalCharges: number;
  lethalCharges: number;
  wave: number;
  score: number;
  xp: number;
  rank: number;
  credits: number;
  bossName?: string;
  bossHealth?: number;
  bossMaxHealth?: number;
  hitmarker: number;
  damageFlash: number;
  reticleSpread: number;
  objectiveProgress: number;
  objectiveProgressLabel?: string;
  notifications: ActiveNotification[];
  setHud: (payload: Partial<Omit<HudState, "setHud" | "pushNotification" | "removeNotification">>) => void;
  pushNotification: (payload: ActiveNotification) => void;
  removeNotification: (id: string) => void;
}

export const useHudStore = create<HudState>((set) => ({
  visible: false,
  missionName: "",
  objective: "",
  modeLabel: "Campaign",
  health: 100,
  maxHealth: 100,
  ammoInMag: 0,
  ammoReserve: 0,
  weaponName: "",
  fireMode: "Auto",
  tacticalLabel: "",
  lethalLabel: "",
  tacticalCharges: 0,
  lethalCharges: 0,
  wave: 0,
  score: 0,
  xp: 0,
  rank: 1,
  credits: 0,
  hitmarker: 0,
  damageFlash: 0,
  reticleSpread: 0,
  objectiveProgress: 0,
  notifications: [],
  setHud: (payload) => set((state) => ({ ...state, ...payload })),
  pushNotification: (payload) => set((state) => ({ notifications: [...state.notifications, payload] })),
  removeNotification: (id) =>
    set((state) => ({ notifications: state.notifications.filter((item) => item.id !== id) })),
}));
