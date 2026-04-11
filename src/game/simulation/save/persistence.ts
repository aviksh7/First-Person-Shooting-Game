import localforage from "localforage";
import { z } from "zod";
import { achievements } from "../../content/achievements/achievements";
import { attachments } from "../../content/attachments/attachments";
import { campaignMissions } from "../../content/missions/missions";
import { allEquipment, allWeapons } from "../../content/weapons/weapons";
import type { ProfileData, SaveSlotData, SettingsData } from "../../core/types/content";
import { defaultSettings, SettingsSchema } from "../settings/settings";

const achievementProgressSchema = z.object({
  unlocked: z.boolean(),
  unlockedAt: z.string().optional(),
});

const profileSchema: z.ZodType<ProfileData> = z.object({
  version: z.number(),
  xp: z.number(),
  credits: z.number(),
  unlockedWeaponIds: z.array(z.string()),
  unlockedAttachmentIds: z.array(z.string()),
  unlockedEquipmentIds: z.array(z.string()),
  loadout: z.object({
    primaryId: z.string(),
    secondaryId: z.string(),
    tacticalId: z.string(),
    lethalId: z.string(),
    attachments: z.record(
      z.string(),
      z.object({
        optic: z.string().optional(),
        muzzle: z.string().optional(),
        magazine: z.string().optional(),
        handling: z.string().optional(),
      }),
    ),
  }),
  campaign: z.object({
    completedMissionIds: z.array(z.string()),
    unlockedMissionIds: z.array(z.string()),
    currentMissionId: z.string().optional(),
  }),
  achievements: z.record(z.string(), achievementProgressSchema),
  stats: z.object({
    totalKills: z.number(),
    missionKills: z.number(),
    bossKills: z.number(),
    survivalBestWave: z.number(),
    missionsCompleted: z.number(),
    noDeathMissionCount: z.number(),
  }),
});

const saveSlotSchema: z.ZodType<SaveSlotData> = z.object({
  version: z.number(),
  slotId: z.number(),
  label: z.string(),
  timestamp: z.string(),
  mode: z.enum(["campaign", "survival"]),
  missionOrMapId: z.string(),
  profileSnapshot: profileSchema,
  checkpoint: z.object({
    objectiveIndex: z.number(),
    playerHealth: z.number(),
    currentWeaponId: z.string(),
    position: z.object({ x: z.number(), z: z.number() }),
    ammo: z.record(
      z.string(),
      z.object({
        magazine: z.number(),
        reserve: z.number(),
      }),
    ),
    wave: z.number(),
    score: z.number(),
  }),
});

const PROFILE_KEY = "iron-pulse/profile";
const SETTINGS_KEY = "iron-pulse/settings";
const SAVE_SLOT_KEY = (slotId: number) => `iron-pulse/save-slot/${slotId}`;

const store = localforage.createInstance({
  name: "iron-pulse",
  storeName: "fps_data",
});

const unlockAllProfileContent = (profile: ProfileData): ProfileData => ({
  ...profile,
  unlockedWeaponIds: allWeapons.map((weapon) => weapon.id),
  unlockedAttachmentIds: attachments.map((attachment) => attachment.id),
  unlockedEquipmentIds: allEquipment.map((equipment) => equipment.id),
  campaign: {
    ...profile.campaign,
    unlockedMissionIds: campaignMissions.map((mission) => mission.id),
  },
});

export const createDefaultProfile = (): ProfileData => ({
  version: 1,
  xp: 0,
  credits: 0,
  unlockedWeaponIds: allWeapons.map((weapon) => weapon.id),
  unlockedAttachmentIds: attachments.map((attachment) => attachment.id),
  unlockedEquipmentIds: allEquipment.map((equipment) => equipment.id),
  loadout: {
    primaryId: "arx4",
    secondaryId: "sidearm45",
    tacticalId: "stim",
    lethalId: "frag",
    attachments: {
      arx4: {
        optic: "optic-red-dot",
      },
      sidearm45: {},
    },
  },
  campaign: {
    completedMissionIds: [],
    unlockedMissionIds: campaignMissions.map((mission) => mission.id),
  },
  achievements: Object.fromEntries(
    achievements.map((achievement) => [
      achievement.id,
      {
        unlocked: false,
      },
    ]),
  ),
  stats: {
    totalKills: 0,
    missionKills: 0,
    bossKills: 0,
    survivalBestWave: 0,
    missionsCompleted: 0,
    noDeathMissionCount: 0,
  },
});

export const loadProfile = async (): Promise<ProfileData> => {
  const raw = await store.getItem<unknown>(PROFILE_KEY);
  if (!raw) {
    const fallback = createDefaultProfile();
    await store.setItem(PROFILE_KEY, fallback);
    return fallback;
  }

  const parsed = profileSchema.safeParse(raw);
  if (parsed.success) {
    const normalized = unlockAllProfileContent(parsed.data);
    await store.setItem(PROFILE_KEY, normalized);
    return normalized;
  }

  const fallback = createDefaultProfile();
  await store.setItem(PROFILE_KEY, fallback);
  return fallback;
};

export const saveProfile = async (profile: ProfileData) => {
  await store.setItem(PROFILE_KEY, profile);
};

export const loadSettings = async (): Promise<SettingsData> => {
  const raw = await store.getItem<unknown>(SETTINGS_KEY);
  if (!raw) {
    await store.setItem(SETTINGS_KEY, defaultSettings);
    return defaultSettings;
  }

  const parsed = SettingsSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }

  await store.setItem(SETTINGS_KEY, defaultSettings);
  return defaultSettings;
};

export const saveSettings = async (settings: SettingsData) => {
  await store.setItem(SETTINGS_KEY, settings);
};

export const loadSaveSlots = async (): Promise<Array<SaveSlotData | null>> =>
  Promise.all([1, 2, 3].map(async (slotId) => {
    const raw = await store.getItem<unknown>(SAVE_SLOT_KEY(slotId));
    if (!raw) {
      return null;
    }
    const parsed = saveSlotSchema.safeParse(raw);
    if (!parsed.success) {
      return null;
    }
    return {
      ...parsed.data,
      profileSnapshot: unlockAllProfileContent(parsed.data.profileSnapshot),
    };
  }));

export const saveSlot = async (slot: SaveSlotData) => {
  await store.setItem(SAVE_SLOT_KEY(slot.slotId), slot);
};

export const clearSlot = async (slotId: number) => {
  await store.removeItem(SAVE_SLOT_KEY(slotId));
};

export const isWeaponUnlocked = (profile: ProfileData, weaponId: string) =>
  allWeapons.some((weapon) => weapon.id === weaponId);

export const isAttachmentUnlocked = (profile: ProfileData, attachmentId: string) =>
  attachments.some((attachment) => attachment.id === attachmentId);

export const isEquipmentUnlocked = (profile: ProfileData, equipmentId: string) =>
  allEquipment.some((equipment) => equipment.id === equipmentId);

export const unlockProfileContent = (profile: ProfileData) => {
  const nextProfile = structuredClone(profile);
  const xp = nextProfile.xp;
  const credits = nextProfile.credits;

  for (const weapon of allWeapons) {
    if (xp >= weapon.unlockXp && credits >= weapon.unlockCost && !nextProfile.unlockedWeaponIds.includes(weapon.id)) {
      nextProfile.unlockedWeaponIds.push(weapon.id);
      nextProfile.credits = Math.max(0, nextProfile.credits - weapon.unlockCost);
    }
  }

  for (const attachment of attachments) {
    if (xp >= attachment.unlockXp && credits >= attachment.unlockCost && !nextProfile.unlockedAttachmentIds.includes(attachment.id)) {
      nextProfile.unlockedAttachmentIds.push(attachment.id);
      nextProfile.credits = Math.max(0, nextProfile.credits - attachment.unlockCost);
    }
  }

  for (const equipment of allEquipment) {
    if (xp >= equipment.unlockXp && credits >= equipment.unlockCost && !nextProfile.unlockedEquipmentIds.includes(equipment.id)) {
      nextProfile.unlockedEquipmentIds.push(equipment.id);
      nextProfile.credits = Math.max(0, nextProfile.credits - equipment.unlockCost);
    }
  }

  return nextProfile;
};
