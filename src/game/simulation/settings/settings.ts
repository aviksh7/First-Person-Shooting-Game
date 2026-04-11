import { z } from "zod";
import type { SettingsData } from "../../core/types/content";

export const SettingsSchema = z.object({
  version: z.number(),
  graphicsPreset: z.enum(["low", "medium", "high"]),
  resolutionScale: z.number().min(0.5).max(1),
  mouseSensitivity: z.number().min(0.2).max(2.4),
  fov: z.number().min(70).max(110),
  masterVolume: z.number().min(0).max(1),
  musicVolume: z.number().min(0).max(1),
  effectsVolume: z.number().min(0).max(1),
  goreEnabled: z.boolean(),
  motionReduced: z.boolean(),
});

export const defaultSettings: SettingsData = {
  version: 1,
  graphicsPreset: "high",
  resolutionScale: 1,
  mouseSensitivity: 1,
  fov: 88,
  masterVolume: 0.75,
  musicVolume: 0.45,
  effectsVolume: 0.85,
  goreEnabled: true,
  motionReduced: false,
};
