import { create } from "zustand";
import type { ProfileData, SaveSlotData, SettingsData } from "../core/types/content";

interface SaveState {
  ready: boolean;
  profile?: ProfileData;
  settings?: SettingsData;
  slots: Array<SaveSlotData | null>;
  setReady: (ready: boolean) => void;
  setProfile: (profile: ProfileData) => void;
  setSettings: (settings: SettingsData) => void;
  setSlots: (slots: Array<SaveSlotData | null>) => void;
}

export const useSaveStore = create<SaveState>((set) => ({
  ready: false,
  slots: [null, null, null],
  setReady: (ready) => set({ ready }),
  setProfile: (profile) => set({ profile }),
  setSettings: (settings) => set({ settings }),
  setSlots: (slots) => set({ slots }),
}));
