export type ModeId = "campaign" | "survival";
export type MenuScreen =
  | "main"
  | "campaign-select"
  | "mission-brief"
  | "loadout"
  | "survival-select"
  | "armory"
  | "achievements"
  | "settings"
  | "pause"
  | "save-slots"
  | "debrief";

export type WeaponCategory = "primary" | "secondary";
export type WeaponArchetype = "assault" | "smg" | "shotgun" | "dmr" | "pistol";
export type AttachmentSlot = "optic" | "muzzle" | "magazine" | "handling";
export type EquipmentCategory = "tactical" | "lethal";
export type EnemyArchetype =
  | "rifleman"
  | "rusher"
  | "marksman"
  | "shield-heavy"
  | "juggernaut"
  | "boss-commander"
  | "boss-siege";
export type ObjectiveKind =
  | "clear-zone"
  | "interact"
  | "destroy-targets"
  | "hold"
  | "boss"
  | "extract";
export type MissionTheme = "urban" | "industrial" | "bunker";
export type GraphicsPreset = "low" | "medium" | "high";

export interface WeaponStats {
  damage: number;
  fireRate: number;
  magazineSize: number;
  reserveAmmo: number;
  reloadTime: number;
  spread: number;
  adsSpread: number;
  range: number;
  moveSpeedMultiplier: number;
  adsMoveSpeedMultiplier: number;
  adsTime: number;
  recoil: number;
  pellets?: number;
}

export interface WeaponStatModifier {
  damage?: number;
  fireRate?: number;
  magazineSize?: number;
  reserveAmmo?: number;
  reloadTime?: number;
  spread?: number;
  adsSpread?: number;
  range?: number;
  moveSpeedMultiplier?: number;
  adsMoveSpeedMultiplier?: number;
  adsTime?: number;
  recoil?: number;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  category: WeaponCategory;
  archetype: WeaponArchetype;
  description: string;
  unlockXp: number;
  unlockCost: number;
  accent: string;
  stats: WeaponStats;
  slots: AttachmentSlot[];
}

export interface AttachmentDefinition {
  id: string;
  name: string;
  slot: AttachmentSlot;
  description: string;
  unlockXp: number;
  unlockCost: number;
  modifiers: WeaponStatModifier;
}

export interface EquipmentDefinition {
  id: string;
  name: string;
  category: EquipmentCategory;
  description: string;
  unlockXp: number;
  unlockCost: number;
  cooldown: number;
  charges: number;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  health: number;
  moveSpeed: number;
  preferredRange: number;
  attackDamage: number;
  attackCooldown: number;
  rewardXp: number;
  rewardCredits: number;
  color: string;
  scale: number;
  armorFrontMultiplier?: number;
}

export interface BossDefinition {
  id: string;
  name: string;
  enemyId: string;
  intro: string;
  rewardXp: number;
  rewardCredits: number;
  achievementId: string;
}

export interface SpawnPoint {
  x: number;
  z: number;
}

export interface ObstacleDefinition {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

export interface ObjectiveDefinition {
  id: string;
  kind: ObjectiveKind;
  label: string;
  description: string;
  zone: SpawnPoint;
  radius?: number;
  holdSeconds?: number;
  targetCount?: number;
  bossId?: string;
  spawnIds?: string[];
}

export interface MissionDefinition {
  id: string;
  name: string;
  theme: MissionTheme;
  description: string;
  narrative: string;
  recommendedRank: number;
  unlockMissionId?: string;
  rewards: {
    xp: number;
    credits: number;
  };
  playerSpawn: SpawnPoint;
  extractPoint: SpawnPoint;
  mapSize: {
    width: number;
    depth: number;
  };
  obstacles: ObstacleDefinition[];
  enemySpawns: Record<string, Array<SpawnPoint & { enemyId: string }>>;
  objectives: ObjectiveDefinition[];
}

export interface SurvivalMapDefinition {
  id: string;
  name: string;
  basedOnMissionId: string;
  theme: MissionTheme;
  description: string;
  playerSpawn: SpawnPoint;
  extractPoint: SpawnPoint;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  creditsReward: number;
}

export interface CampaignProgress {
  completedMissionIds: string[];
  unlockedMissionIds: string[];
  currentMissionId?: string;
}

export interface AchievementProgress {
  unlocked: boolean;
  unlockedAt?: string;
}

export interface PlayerLoadout {
  primaryId: string;
  secondaryId: string;
  tacticalId: string;
  lethalId: string;
  attachments: Record<string, Partial<Record<AttachmentSlot, string>>>;
}

export interface PlayerStats {
  totalKills: number;
  missionKills: number;
  bossKills: number;
  survivalBestWave: number;
  missionsCompleted: number;
  noDeathMissionCount: number;
}

export interface ProfileData {
  version: number;
  xp: number;
  credits: number;
  unlockedWeaponIds: string[];
  unlockedAttachmentIds: string[];
  unlockedEquipmentIds: string[];
  loadout: PlayerLoadout;
  campaign: CampaignProgress;
  achievements: Record<string, AchievementProgress>;
  stats: PlayerStats;
}

export interface SettingsData {
  version: number;
  graphicsPreset: GraphicsPreset;
  resolutionScale: number;
  mouseSensitivity: number;
  fov: number;
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  goreEnabled: boolean;
  motionReduced: boolean;
}

export interface SaveSlotData {
  version: number;
  slotId: number;
  label: string;
  timestamp: string;
  mode: ModeId;
  missionOrMapId: string;
  profileSnapshot: ProfileData;
  checkpoint: {
    objectiveIndex: number;
    playerHealth: number;
    currentWeaponId: string;
    position: SpawnPoint;
    ammo: Record<string, { magazine: number; reserve: number }>;
    wave: number;
    score: number;
  };
}

export interface ActiveNotification {
  id: string;
  title: string;
  detail?: string;
}
