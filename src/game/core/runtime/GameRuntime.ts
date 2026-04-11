import {
  Color3,
  Color4,
  Engine,
  GlowLayer,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  StandardMaterial,
  TransformNode,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import { bosses } from "../../content/bosses/bosses";
import { campaignMissions, survivalMaps } from "../../content/missions/missions";
import { enemies as enemyDefinitions } from "../../content/enemies/enemies";
import { achievements } from "../../content/achievements/achievements";
import { attachments } from "../../content/attachments/attachments";
import {
  allEquipment,
  allWeapons,
  lethalEquipment,
  primaryWeapons,
  secondaryWeapons,
  tacticalEquipment,
} from "../../content/weapons/weapons";
import { economyConfig, getRankFromXp } from "../../content/economy/economy";
import type {
  AchievementDefinition,
  AttachmentDefinition,
  AttachmentSlot,
  BossDefinition,
  EnemyDefinition,
  EquipmentDefinition,
  MenuScreen,
  MissionDefinition,
  ModeId,
  ObstacleDefinition,
  PlayerLoadout,
  ProfileData,
  SaveSlotData,
  SettingsData,
  SpawnPoint,
  SurvivalMapDefinition,
  WeaponDefinition,
  WeaponStats,
} from "../types/content";
import { useHudStore } from "../../ui-bridge/hud-store";
import { useMenuStore } from "../../ui-bridge/menu-store";
import { useSaveStore } from "../../ui-bridge/save-store";
import {
  clearSlot,
  isAttachmentUnlocked,
  isEquipmentUnlocked,
  isWeaponUnlocked,
  loadProfile,
  loadSaveSlots,
  loadSettings,
  saveProfile,
  saveSettings,
  saveSlot,
} from "../../simulation/save/persistence";
import { getAppliedWeaponStats } from "../../simulation/weapons/weapon-utils";

interface AabbObstacle extends ObstacleDefinition {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface RuntimeEnemy {
  id: string;
  definition: EnemyDefinition;
  mesh: Mesh;
  shieldMesh?: Mesh;
  health: number;
  maxHealth: number;
  attackCooldown: number;
  stunTimer: number;
  alive: boolean;
  groupId: string;
  spawnedReinforcements: boolean;
}

interface ObjectiveTarget {
  id: string;
  mesh: Mesh;
  objectiveId: string;
  alive: boolean;
}

interface PersistentAreaEffect {
  id: string;
  mesh: Mesh;
  expiresAt: number;
  dps: number;
}

interface RuntimeWeaponState {
  weaponId: string;
  magazine: number;
  reserve: number;
}

interface PlayerState {
  position: Vector3;
  velocityY: number;
  health: number;
  maxHealth: number;
  crouching: boolean;
  sprinting: boolean;
  adsWeight: number;
  reloadTimer: number;
  fireCooldown: number;
  interactTimer: number;
  tacticalCharges: number;
  lethalCharges: number;
  tacticalCooldown: number;
  lethalCooldown: number;
  currentWeaponId: string;
  weaponStates: Record<string, RuntimeWeaponState>;
  checkpointDeaths: number;
  recentStimClutch: boolean;
  speedBoostTimer: number;
  damageFlash: number;
  damageCooldown: number;
  hitmarkerTimer: number;
  weaponKick: number;
  recoilYaw: number;
  recoilPitch: number;
  movementPhase: number;
}

interface CheckpointState {
  objectiveIndex: number;
  playerHealth: number;
  currentWeaponId: string;
  position: SpawnPoint;
  ammo: Record<string, { magazine: number; reserve: number }>;
  wave: number;
  score: number;
}

const PLAYER_RADIUS = 1.05;
const PLAYER_EYE_HEIGHT = 1.8;
const CROUCH_EYE_HEIGHT = 1.25;
const GRAVITY = 28;
const JUMP_VELOCITY = 10.5;
const HOLD_DECAY = 1.4;
const WAVE_CLEAR_DELAY = 2.5;
const BASE_MOVE_SPEED = 8.2;
const SPRINT_MULTIPLIER = 1.35;
const CROUCH_MULTIPLIER = 0.6;
const themePalette = {
  urban: {
    clear: Color4.FromHexString("#08121eff"),
    fog: Color3.FromHexString("#0e1826"),
    ground: Color3.FromHexString("#202f3f"),
    wall: Color3.FromHexString("#415468"),
    accent: Color3.FromHexString("#7ec8ff"),
    emissive: Color3.FromHexString("#16283b"),
  },
  industrial: {
    clear: Color4.FromHexString("#121112ff"),
    fog: Color3.FromHexString("#2a2120"),
    ground: Color3.FromHexString("#332c28"),
    wall: Color3.FromHexString("#63564f"),
    accent: Color3.FromHexString("#ffb36b"),
    emissive: Color3.FromHexString("#301d10"),
  },
  bunker: {
    clear: Color4.FromHexString("#070707ff"),
    fog: Color3.FromHexString("#1a1b1f"),
    ground: Color3.FromHexString("#1e2229"),
    wall: Color3.FromHexString("#434a56"),
    accent: Color3.FromHexString("#ff6d6d"),
    emissive: Color3.FromHexString("#1b1012"),
  },
} as const;

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const generateId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

const flatten = (x: number, z: number) => new Vector3(x, PLAYER_EYE_HEIGHT, z);

export class GameRuntime {
  readonly canvas: HTMLCanvasElement;
  readonly engine: Engine;

  private scene?: Scene;
  private camera?: UniversalCamera;
  private glow?: GlowLayer;
  private weaponRoot?: TransformNode;
  private weaponBody?: Mesh;
  private crosshairTarget?: Mesh;
  private profile!: ProfileData;
  private settings!: SettingsData;
  private saveSlots: Array<SaveSlotData | null> = [null, null, null];
  private activeMode?: ModeId;
  private activeMission?: MissionDefinition;
  private activeSurvivalMap?: SurvivalMapDefinition;
  private obstacles: AabbObstacle[] = [];
  private enemies: RuntimeEnemy[] = [];
  private objectiveTargets: ObjectiveTarget[] = [];
  private persistentAreaEffects: PersistentAreaEffect[] = [];
  private currentObjectiveIndex = 0;
  private currentObjectiveProgress = 0;
  private player: PlayerState = this.createPlayerState();
  private score = 0;
  private wave = 0;
  private waveDelay = 0;
  private runTime = 0;
  private runKills = 0;
  private bossBarEnemyId?: string;
  private checkpoint?: CheckpointState;
  private lastFrameTime = performance.now();
  private paused = true;
  private disposed = false;
  private mouseDown = false;
  private rightMouseDown = false;
  private pressedKeys = new Set<string>();
  private heldKeys = new Set<string>();
  private pointerLocked = false;
  private previousScreen: MenuScreen = "main";
  private missionFailed = false;
  private loadingPromise: Promise<void>;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
      powerPreference: "high-performance",
    });

    this.loadingPromise = this.bootstrap();

    this.engine.runRenderLoop(() => {
      const now = performance.now();
      const dt = Math.min(0.033, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;
      if (!this.paused && this.scene && !this.disposed) {
        this.update(dt);
      }
      this.scene?.render();
    });

    window.addEventListener("resize", this.handleResize);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mouseup", this.handleMouseUp);
    canvas.addEventListener("click", this.handleCanvasClick);
  }

  async whenReady() {
    await this.loadingPromise;
  }

  dispose() {
    this.disposed = true;
    this.exitPointerLock();
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mouseup", this.handleMouseUp);
    this.canvas.removeEventListener("click", this.handleCanvasClick);
    this.scene?.dispose();
    this.engine.dispose();
  }

  getProfile() {
    return this.profile;
  }

  getSettings() {
    return this.settings;
  }

  getSaveSlots() {
    return this.saveSlots;
  }

  startCampaignMission(missionId: string) {
    const mission = campaignMissions.find((item) => item.id === missionId);
    if (!mission) {
      return;
    }
    this.activeMode = "campaign";
    this.activeMission = mission;
    this.activeSurvivalMap = undefined;
    this.profile.campaign.currentMissionId = mission.id;
    void this.persistProfile();
    this.buildMissionScene(mission);
    this.resume();
  }

  startSurvivalMap(mapId: string) {
    const survivalMap = survivalMaps.find((item) => item.id === mapId);
    if (!survivalMap) {
      return;
    }
    const mission = campaignMissions.find((item) => item.id === survivalMap.basedOnMissionId);
    if (!mission) {
      return;
    }
    this.activeMode = "survival";
    this.activeMission = mission;
    this.activeSurvivalMap = survivalMap;
    this.buildMissionScene(mission, survivalMap);
    this.wave = 0;
    this.waveDelay = 0.5;
    this.score = 0;
    this.resume();
  }

  resume() {
    if (!this.scene) {
      return;
    }
    this.paused = false;
    this.missionFailed = false;
    useMenuStore.getState().setPaused(false);
    useMenuStore.getState().setScreen(
      this.activeMode === "campaign" || this.activeMode === "survival" ? "pause" : "main",
    );
    useHudStore.getState().setHud({ visible: true });
  }

  pause() {
    if (!this.activeMode) {
      return;
    }
    this.paused = true;
    useMenuStore.getState().setPaused(true);
    useMenuStore.getState().setScreen("pause");
    this.exitPointerLock();
  }

  returnToMainMenu() {
    this.paused = true;
    this.activeMode = undefined;
    this.activeMission = undefined;
    this.activeSurvivalMap = undefined;
    this.enemies = [];
    this.objectiveTargets = [];
    this.persistentAreaEffects = [];
    this.scene?.dispose();
    this.scene = undefined;
    this.camera = undefined;
    this.weaponRoot = undefined;
    useHudStore.getState().setHud({ visible: false, bossHealth: undefined, bossMaxHealth: undefined, bossName: undefined });
    useMenuStore.getState().setActiveMode(undefined);
    useMenuStore.getState().setPaused(false);
    useMenuStore.getState().setScreen("main");
    this.exitPointerLock();
  }

  restartFromCheckpoint() {
    if (!this.activeMode || !this.activeMission) {
      return;
    }

    if (this.activeMode === "campaign") {
      const checkpoint = this.checkpoint;
      this.buildMissionScene(this.activeMission);
      if (checkpoint) {
        this.restoreCheckpoint(checkpoint);
      }
      this.resume();
      return;
    }

    if (this.activeSurvivalMap) {
      this.startSurvivalMap(this.activeSurvivalMap.id);
    }
  }

  async saveCurrentRun(slotId: number) {
    if (!this.activeMode || !this.activeMission) {
      return;
    }

    const checkpoint = this.captureCheckpoint();
    const slot: SaveSlotData = {
      version: 1,
      slotId,
      label: this.activeMode === "campaign" ? this.activeMission.name : this.activeSurvivalMap?.name ?? "Survival Run",
      timestamp: new Date().toISOString(),
      mode: this.activeMode,
      missionOrMapId: this.activeMode === "campaign" ? this.activeMission.id : this.activeSurvivalMap!.id,
      profileSnapshot: structuredClone(this.profile),
      checkpoint,
    };

    await saveSlot(slot);
    this.saveSlots[slotId - 1] = slot;
    useSaveStore.getState().setSlots([...this.saveSlots]);
    this.notify("Run Saved", `Slot ${slotId} updated.`);
  }

  async loadRun(slotId: number) {
    const slot = this.saveSlots[slotId - 1];
    if (!slot) {
      return;
    }

    this.profile = structuredClone(slot.profileSnapshot);
    useSaveStore.getState().setProfile(this.profile);
    await this.persistProfile();

    if (slot.mode === "campaign") {
      this.startCampaignMission(slot.missionOrMapId);
    } else {
      this.startSurvivalMap(slot.missionOrMapId);
    }
    this.restoreCheckpoint(slot.checkpoint);
    this.resume();
    this.notify("Run Loaded", slot.label);
  }

  async clearRunSlot(slotId: number) {
    await clearSlot(slotId);
    this.saveSlots[slotId - 1] = null;
    useSaveStore.getState().setSlots([...this.saveSlots]);
  }

  async updateSettings(partial: Partial<SettingsData>) {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    useSaveStore.getState().setSettings(this.settings);
    await saveSettings(this.settings);
    this.applySettings();
  }

  async setLoadout(loadout: PlayerLoadout) {
    this.profile.loadout = structuredClone(loadout);
    useSaveStore.getState().setProfile(structuredClone(this.profile));
    await this.persistProfile();
  }

  async purchaseWeapon(weaponId: string) {
    const weapon = allWeapons.find((item) => item.id === weaponId);
    if (!weapon || this.profile.unlockedWeaponIds.includes(weaponId)) {
      return;
    }
    if (this.profile.xp < weapon.unlockXp || this.profile.credits < weapon.unlockCost) {
      return;
    }
    this.profile.credits -= weapon.unlockCost;
    this.profile.unlockedWeaponIds.push(weaponId);
    useSaveStore.getState().setProfile(structuredClone(this.profile));
    await this.persistProfile();
    this.notify("Weapon Unlocked", weapon.name);
  }

  async purchaseAttachment(attachmentId: string) {
    const attachment = attachments.find((item) => item.id === attachmentId);
    if (!attachment || this.profile.unlockedAttachmentIds.includes(attachmentId)) {
      return;
    }
    if (this.profile.xp < attachment.unlockXp || this.profile.credits < attachment.unlockCost) {
      return;
    }
    this.profile.credits -= attachment.unlockCost;
    this.profile.unlockedAttachmentIds.push(attachmentId);
    useSaveStore.getState().setProfile(structuredClone(this.profile));
    await this.persistProfile();
    this.notify("Attachment Unlocked", attachment.name);
  }

  async purchaseEquipment(equipmentId: string) {
    const equipment = allEquipment.find((item) => item.id === equipmentId);
    if (!equipment || this.profile.unlockedEquipmentIds.includes(equipmentId)) {
      return;
    }
    if (this.profile.xp < equipment.unlockXp || this.profile.credits < equipment.unlockCost) {
      return;
    }
    this.profile.credits -= equipment.unlockCost;
    this.profile.unlockedEquipmentIds.push(equipmentId);
    useSaveStore.getState().setProfile(structuredClone(this.profile));
    await this.persistProfile();
    this.notify("Equipment Unlocked", equipment.name);
  }

  getWeaponsByCategory(category: "primary" | "secondary") {
    return category === "primary" ? primaryWeapons : secondaryWeapons;
  }

  getTacticals() {
    return tacticalEquipment;
  }

  getLethals() {
    return lethalEquipment;
  }

  isWeaponUnlocked(weaponId: string) {
    return isWeaponUnlocked(this.profile, weaponId);
  }

  isAttachmentUnlocked(attachmentId: string) {
    return isAttachmentUnlocked(this.profile, attachmentId);
  }

  isEquipmentUnlocked(equipmentId: string) {
    return isEquipmentUnlocked(this.profile, equipmentId);
  }

  getAttachmentsForSlot(slot: AttachmentSlot) {
    return attachments.filter((item) => item.slot === slot);
  }

  captureStateText() {
    const enemies = this.enemies.filter((enemy) => enemy.alive).map((enemy) => ({
      id: enemy.definition.id,
      x: Number(enemy.mesh.position.x.toFixed(1)),
      y: Number(enemy.mesh.position.y.toFixed(1)),
      z: Number(enemy.mesh.position.z.toFixed(1)),
      hp: Number(enemy.health.toFixed(1)),
    }));

    const payload = {
      coordinateSystem: "Origin centered on the map. +X is right, +Z is forward, Y is height.",
      mode: this.activeMode ?? "menu",
      mission: this.activeMission?.id ?? null,
      survivalMap: this.activeSurvivalMap?.id ?? null,
      objective:
        this.activeMode === "campaign"
          ? this.activeMission?.objectives[this.currentObjectiveIndex]?.label ?? null
          : `Wave ${this.wave || 1}`,
      player: {
        x: Number(this.player.position.x.toFixed(1)),
        y: Number(this.player.position.y.toFixed(1)),
        z: Number(this.player.position.z.toFixed(1)),
        hp: Number(this.player.health.toFixed(1)),
        weapon: this.player.currentWeaponId,
        paused: this.paused,
      },
      combat: {
        enemiesAlive: enemies.length,
        score: this.score,
        wave: this.wave,
      },
      enemies,
    };

    return JSON.stringify(payload);
  }

  advanceTime(ms: number) {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) {
      if (!this.paused) {
        this.update(1 / 60);
      }
    }
    this.scene?.render();
  }

  private async bootstrap() {
    this.profile = await loadProfile();
    this.settings = await loadSettings();
    this.saveSlots = await loadSaveSlots();
    useSaveStore.getState().setProfile(structuredClone(this.profile));
    useSaveStore.getState().setSettings(this.settings);
    useSaveStore.getState().setSlots([...this.saveSlots]);
    useSaveStore.getState().setReady(true);
    this.applySettings();
    this.exposeTestHooks();
    useMenuStore.getState().setScreen("main");
  }

  private applySettings() {
    this.engine.setHardwareScalingLevel(1 / this.settings.resolutionScale);
    if (this.camera) {
      this.camera.fov = (this.settings.fov * Math.PI) / 180;
    }
  }

  private exposeTestHooks() {
    window.render_game_to_text = () => this.captureStateText();
    window.advanceTime = (ms: number) => this.advanceTime(ms);
    window.ironPulseRuntime = this;
  }

  private createPlayerState(): PlayerState {
    return {
      position: new Vector3(0, PLAYER_EYE_HEIGHT, 0),
      velocityY: 0,
      health: 100,
      maxHealth: 100,
      crouching: false,
      sprinting: false,
      adsWeight: 0,
      reloadTimer: 0,
      fireCooldown: 0,
      interactTimer: 0,
      tacticalCharges: 2,
      lethalCharges: 2,
      tacticalCooldown: 0,
      lethalCooldown: 0,
      currentWeaponId: this.profile?.loadout.primaryId ?? "arx4",
      weaponStates: {},
      checkpointDeaths: 0,
      recentStimClutch: false,
      speedBoostTimer: 0,
      damageFlash: 0,
      damageCooldown: 0,
      hitmarkerTimer: 0,
      weaponKick: 0,
      recoilYaw: 0,
      recoilPitch: 0,
      movementPhase: 0,
    };
  }

  private buildMissionScene(mission: MissionDefinition, survivalMap?: SurvivalMapDefinition) {
    this.scene?.dispose();
    this.scene = new Scene(this.engine);
    this.scene.collisionsEnabled = false;
    this.scene.clearColor = themePalette[mission.theme].clear;
    this.scene.ambientColor = themePalette[mission.theme].emissive;
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0045;
    this.scene.fogColor = themePalette[mission.theme].fog;
    this.glow = new GlowLayer("glow", this.scene);
    this.glow.intensity = 0.4;

    const light = new HemisphericLight("ambient", new Vector3(0.1, 1, 0.05), this.scene);
    light.diffuse = new Color3(0.92, 0.92, 0.97);
    light.groundColor = new Color3(0.18, 0.2, 0.25);
    light.intensity = 0.92;

    const accentLight = new HemisphericLight("accent", new Vector3(-0.5, 1, -0.4), this.scene);
    accentLight.diffuse = themePalette[mission.theme].accent;
    accentLight.intensity = 0.22;

    const sky = MeshBuilder.CreateSphere("sky", { diameter: 280, segments: 16 }, this.scene);
    const skyMaterial = new StandardMaterial("sky-mat", this.scene);
    skyMaterial.backFaceCulling = false;
    skyMaterial.disableLighting = true;
    skyMaterial.diffuseColor = themePalette[mission.theme].fog.scale(0.35);
    skyMaterial.emissiveColor =
      mission.theme === "urban"
        ? new Color3(0.05, 0.09, 0.14)
        : mission.theme === "industrial"
          ? new Color3(0.13, 0.09, 0.07)
          : new Color3(0.08, 0.08, 0.1);
    sky.material = skyMaterial;

    const groundMaterial = new PBRMaterial("ground", this.scene);
    groundMaterial.albedoColor = themePalette[mission.theme].ground;
    groundMaterial.metallic = mission.theme === "industrial" ? 0.34 : 0.12;
    groundMaterial.roughness = 0.7;
    groundMaterial.emissiveColor = themePalette[mission.theme].emissive.scale(0.18);

    const wallMaterial = new PBRMaterial("walls", this.scene);
    wallMaterial.albedoColor = themePalette[mission.theme].wall;
    wallMaterial.metallic = 0.16;
    wallMaterial.roughness = 0.64;

    const accentMaterial = new StandardMaterial("accent", this.scene);
    accentMaterial.diffuseColor = themePalette[mission.theme].accent;
    accentMaterial.emissiveColor = themePalette[mission.theme].accent.scale(0.65);

    const ground = MeshBuilder.CreateGround(
      "ground",
      {
        width: mission.mapSize.width,
        height: mission.mapSize.depth,
      },
      this.scene,
    );
    ground.material = groundMaterial;
    ground.position.y = 0;

    this.obstacles = [];
    const boundaryThickness = 3;
    const halfWidth = mission.mapSize.width / 2;
    const halfDepth = mission.mapSize.depth / 2;

    const allObstacles = [
      { x: 0, z: -halfDepth, width: mission.mapSize.width + boundaryThickness * 2, depth: boundaryThickness, height: 5 },
      { x: 0, z: halfDepth, width: mission.mapSize.width + boundaryThickness * 2, depth: boundaryThickness, height: 5 },
      { x: -halfWidth, z: 0, width: boundaryThickness, depth: mission.mapSize.depth + boundaryThickness * 2, height: 5 },
      { x: halfWidth, z: 0, width: boundaryThickness, depth: mission.mapSize.depth + boundaryThickness * 2, height: 5 },
      ...mission.obstacles,
    ];

    for (const [index, obstacle] of allObstacles.entries()) {
      const box = MeshBuilder.CreateBox(
        `wall-${index}`,
        {
          width: obstacle.width,
          depth: obstacle.depth,
          height: obstacle.height,
        },
        this.scene,
      );
      box.position = new Vector3(obstacle.x, obstacle.height / 2, obstacle.z);
      box.material = wallMaterial;
      this.recordObstacle(obstacle);
    }

    for (let i = 0; i < 16; i += 1) {
      const lightTower = MeshBuilder.CreateBox(
        `accent-${i}`,
        { width: 1.2, depth: 1.2, height: randomBetween(2.2, 5.6) },
        this.scene,
      );
      lightTower.material = accentMaterial;
      lightTower.position = new Vector3(
        randomBetween(-halfWidth + 8, halfWidth - 8),
        lightTower.scaling.y + 0.6,
        randomBetween(-halfDepth + 8, halfDepth - 8),
      );
    }

    for (let i = 0; i < 18; i += 1) {
      const prop = MeshBuilder.CreateBox(
        `cover-prop-${i}`,
        {
          width: randomBetween(1.6, 3.8),
          depth: randomBetween(1.2, 2.6),
          height: randomBetween(0.9, 1.8),
        },
        this.scene,
      );
      prop.material = wallMaterial;
      prop.position = new Vector3(
        randomBetween(-halfWidth + 9, halfWidth - 9),
        prop.getBoundingInfo().boundingBox.extendSize.y,
        randomBetween(-halfDepth + 12, halfDepth - 12),
      );
    }

    this.camera = new UniversalCamera("playerCamera", flatten(mission.playerSpawn.x, mission.playerSpawn.z), this.scene);
    this.camera.fov = (this.settings.fov * Math.PI) / 180;
    this.camera.minZ = 0.05;
    this.camera.maxZ = 200;
    this.camera.rotation.x = -0.12;
    this.camera.rotation.y = Math.PI;
    this.camera.position.copyFrom(flatten(
      survivalMap?.playerSpawn.x ?? mission.playerSpawn.x,
      survivalMap?.playerSpawn.z ?? mission.playerSpawn.z,
    ));
    this.scene.activeCamera = this.camera;

    this.player = this.createPlayerState();
    this.player.position = this.camera.position.clone();
    this.player.currentWeaponId = this.profile.loadout.primaryId;
    this.initializeAmmoState();
    this.player.tacticalCharges = tacticalEquipment.find((item) => item.id === this.profile.loadout.tacticalId)?.charges ?? 2;
    this.player.lethalCharges = lethalEquipment.find((item) => item.id === this.profile.loadout.lethalId)?.charges ?? 2;

    this.weaponRoot = new TransformNode("weapon-root", this.scene);
    this.weaponRoot.parent = this.camera;
    this.weaponRoot.position = new Vector3(0.35, -0.42, 0.68);
    this.weaponBody = MeshBuilder.CreateBox("weapon-body", { width: 0.18, height: 0.14, depth: 0.72 }, this.scene);
    this.weaponBody.parent = this.weaponRoot;
    this.crosshairTarget = MeshBuilder.CreatePlane("aim-anchor", { size: 0.05 }, this.scene);
    this.crosshairTarget.isVisible = false;
    this.rebuildWeaponViewModel();

    this.currentObjectiveIndex = 0;
    this.currentObjectiveProgress = 0;
    this.runKills = 0;
    this.score = 0;
    this.wave = 0;
    this.waveDelay = 0;
    this.runTime = 0;
    this.missionFailed = false;
    this.enemies = [];
    this.objectiveTargets = [];
    this.persistentAreaEffects = [];
    this.bossBarEnemyId = undefined;
    this.checkpoint = undefined;
    useMenuStore.getState().setActiveMode(survivalMap ? "survival" : "campaign");
    useMenuStore.getState().setPaused(false);
    useHudStore.getState().setHud({
      visible: true,
      missionName: survivalMap ? survivalMap.name : mission.name,
      objective: survivalMap ? "Hold the line" : mission.objectives[0]?.label ?? "",
      modeLabel: survivalMap ? "Survival" : "Campaign",
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      score: this.score,
      wave: this.wave,
      xp: this.profile.xp,
      rank: getRankFromXp(this.profile.xp),
      credits: this.profile.credits,
      bossHealth: undefined,
      bossMaxHealth: undefined,
      bossName: undefined,
    });

    if (survivalMap) {
      useMenuStore.getState().setSelectedSurvivalId(survivalMap.id);
    } else {
      useMenuStore.getState().setSelectedMissionId(mission.id);
      this.spawnObjectiveEnemies(mission.objectives[0]?.spawnIds ?? []);
      this.createObjectiveArtifacts(mission.objectives[0]);
      this.checkpoint = this.captureCheckpoint();
    }

    this.paused = true;
    this.syncHud();
  }

  private recordObstacle(obstacle: ObstacleDefinition) {
    this.obstacles.push({
      ...obstacle,
      minX: obstacle.x - obstacle.width / 2,
      maxX: obstacle.x + obstacle.width / 2,
      minZ: obstacle.z - obstacle.depth / 2,
      maxZ: obstacle.z + obstacle.depth / 2,
    });
  }

  private initializeAmmoState() {
    this.player.weaponStates = {};
    for (const weaponId of [this.profile.loadout.primaryId, this.profile.loadout.secondaryId]) {
      const applied = getAppliedWeaponStats(weaponId, this.profile.loadout);
      if (!applied.weapon || !applied.stats) {
        continue;
      }
      this.player.weaponStates[weaponId] = {
        weaponId,
        magazine: applied.stats.magazineSize,
        reserve: applied.stats.reserveAmmo,
      };
    }
  }

  private restoreCheckpoint(checkpoint: CheckpointState) {
    this.currentObjectiveIndex = checkpoint.objectiveIndex;
    this.player.health = checkpoint.playerHealth;
    this.player.currentWeaponId = checkpoint.currentWeaponId;
    this.player.position = flatten(checkpoint.position.x, checkpoint.position.z);
    this.camera?.position.copyFrom(this.player.position);
    this.player.weaponStates = Object.fromEntries(
      Object.entries(checkpoint.ammo).map(([weaponId, ammo]) => [
        weaponId,
        { weaponId, magazine: ammo.magazine, reserve: ammo.reserve },
      ]),
    );
    this.score = checkpoint.score;
    this.wave = checkpoint.wave;
    this.spawnObjectiveEnemies(this.activeMission?.objectives[this.currentObjectiveIndex]?.spawnIds ?? []);
    this.createObjectiveArtifacts(this.activeMission?.objectives[this.currentObjectiveIndex]);
    this.syncHud();
  }

  private captureCheckpoint(): CheckpointState {
    return {
      objectiveIndex: this.currentObjectiveIndex,
      playerHealth: this.player.health,
      currentWeaponId: this.player.currentWeaponId,
      position: {
        x: this.player.position.x,
        z: this.player.position.z,
      },
      ammo: Object.fromEntries(
        Object.entries(this.player.weaponStates).map(([weaponId, state]) => [
          weaponId,
          { magazine: state.magazine, reserve: state.reserve },
        ]),
      ),
      wave: this.wave,
      score: this.score,
    };
  }

  private update(dt: number) {
    this.runTime += dt;
    this.updatePlayerMovement(dt);
    this.updateWeaponState(dt);
    this.updateEnemies(dt);
    this.updateAreaEffects(dt);
    if (this.activeMode === "campaign") {
      this.updateObjectiveState(dt);
    } else {
      this.updateSurvivalState(dt);
    }
    this.updateWeaponViewModel(dt);
    this.syncHud();
  }

  private updatePlayerMovement(dt: number) {
    if (!this.camera) {
      return;
    }

    this.player.crouching = this.pressedKeys.has("Control");
    this.player.sprinting = this.pressedKeys.has("Shift") && !this.player.crouching && !this.rightMouseDown;
    this.player.tacticalCooldown = Math.max(0, this.player.tacticalCooldown - dt);
    this.player.lethalCooldown = Math.max(0, this.player.lethalCooldown - dt);
    this.player.fireCooldown = Math.max(0, this.player.fireCooldown - dt);
    this.player.reloadTimer = Math.max(0, this.player.reloadTimer - dt);
    this.player.speedBoostTimer = Math.max(0, this.player.speedBoostTimer - dt);
    this.player.damageFlash = Math.max(0, this.player.damageFlash - dt * 1.45);
    this.player.damageCooldown = Math.max(0, this.player.damageCooldown - dt);
    this.player.hitmarkerTimer = Math.max(0, this.player.hitmarkerTimer - dt * 4.2);
    this.player.weaponKick = Math.max(0, this.player.weaponKick - dt * 4.5);
    this.player.recoilYaw *= Math.max(0, 1 - dt * 12);
    this.player.recoilPitch *= Math.max(0, 1 - dt * 12);
    this.player.adsWeight += ((this.rightMouseDown ? 1 : 0) - this.player.adsWeight) * Math.min(1, dt * 10);

    const { stats } = getAppliedWeaponStats(this.player.currentWeaponId, this.profile.loadout);
    const moveMultiplier = stats?.moveSpeedMultiplier ?? 1;
    const adsMoveMultiplier = stats?.adsMoveSpeedMultiplier ?? 0.82;
    const speed =
      BASE_MOVE_SPEED *
      moveMultiplier *
      (this.player.sprinting ? SPRINT_MULTIPLIER : 1) *
      (this.player.crouching ? CROUCH_MULTIPLIER : 1) *
      (this.rightMouseDown ? adsMoveMultiplier : 1) *
      (this.player.speedBoostTimer > 0 ? 1.18 : 1);

    const forward = new Vector3(Math.sin(this.camera.rotation.y), 0, Math.cos(this.camera.rotation.y));
    const right = new Vector3(forward.z, 0, -forward.x);
    const inputDirection = Vector3.Zero();
    if (this.pressedKeys.has("w")) inputDirection.addInPlace(forward);
    if (this.pressedKeys.has("s")) inputDirection.subtractInPlace(forward);
    if (this.pressedKeys.has("a")) inputDirection.subtractInPlace(right);
    if (this.pressedKeys.has("d")) inputDirection.addInPlace(right);
    if (inputDirection.lengthSquared() > 0.001) {
      inputDirection.normalize();
    }
    const moveStrength = inputDirection.length();
    this.player.movementPhase += dt * speed * 0.62 * (moveStrength > 0 ? 1 : 0);

    const moveDelta = inputDirection.scale(speed * dt);
    let nextX = this.player.position.x;
    let nextZ = this.player.position.z;
    nextX = this.resolvePlayerAxis(nextX + moveDelta.x, this.player.position.z, "x");
    nextZ = this.resolvePlayerAxis(nextX, nextZ + moveDelta.z, "z");

    const currentHeight = this.player.crouching ? CROUCH_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
    const grounded = this.player.position.y <= currentHeight + 0.001;
    if (grounded) {
      this.player.position.y = currentHeight;
      if (this.pressedKeys.has(" ") || this.pressedKeys.has("space")) {
        this.player.velocityY = JUMP_VELOCITY;
      }
    }
    this.player.velocityY -= GRAVITY * dt;
    this.player.position.y = Math.max(currentHeight, this.player.position.y + this.player.velocityY * dt);
    if (this.player.position.y <= currentHeight) {
      this.player.position.y = currentHeight;
      this.player.velocityY = 0;
    }

    this.player.position.x = nextX;
    this.player.position.z = nextZ;
    this.camera.position.copyFrom(this.player.position);
    this.camera.rotation.x = Math.max(-1.3, Math.min(1.1, this.camera.rotation.x + this.player.recoilPitch * dt));
    this.camera.rotation.y += this.player.recoilYaw * dt;

    const fovBase = this.settings.fov;
    const sprintFov = fovBase + (this.player.sprinting ? 6 : 0);
    const adsFov = sprintFov - this.player.adsWeight * 9;
    const nextFov = (adsFov * Math.PI) / 180;
    this.camera.fov += (nextFov - this.camera.fov) * Math.min(1, dt * 10);

    if (this.pressedKeys.has("e")) {
      this.handleInteract(dt);
    } else {
      this.player.interactTimer = Math.max(0, this.player.interactTimer - dt * HOLD_DECAY);
    }
  }

  private resolvePlayerAxis(nextX: number, nextZ: number, axis: "x" | "z") {
    if (!this.activeMission) {
      return axis === "x" ? nextX : nextZ;
    }

    for (const obstacle of this.obstacles) {
      if (
        nextX > obstacle.minX - PLAYER_RADIUS &&
        nextX < obstacle.maxX + PLAYER_RADIUS &&
        nextZ > obstacle.minZ - PLAYER_RADIUS &&
        nextZ < obstacle.maxZ + PLAYER_RADIUS
      ) {
        return axis === "x" ? this.player.position.x : this.player.position.z;
      }
    }

    const halfWidth = this.activeMission.mapSize.width / 2 - PLAYER_RADIUS - 1.5;
    const halfDepth = this.activeMission.mapSize.depth / 2 - PLAYER_RADIUS - 1.5;
    if (axis === "x") {
      return Math.max(-halfWidth, Math.min(halfWidth, nextX));
    }
    return Math.max(-halfDepth, Math.min(halfDepth, nextZ));
  }

  private updateWeaponState(_dt: number) {
    const { weapon, stats } = getAppliedWeaponStats(this.player.currentWeaponId, this.profile.loadout);
    if (!weapon || !stats) {
      return;
    }

    if (this.player.reloadTimer === 0 && this.heldKeys.has("r")) {
      this.beginReload(stats);
    }

    if (this.player.reloadTimer > 0 && this.player.reloadTimer <= 0.02) {
      this.finishReload(stats);
    }

    const shouldFire = this.mouseDown && this.player.fireCooldown <= 0 && this.player.reloadTimer <= 0;
    if (shouldFire) {
      const ammo = this.player.weaponStates[this.player.currentWeaponId];
      if (!ammo || ammo.magazine <= 0) {
        this.beginReload(stats);
      } else {
        this.fireWeapon(weapon, stats);
      }
    }
  }

  private beginReload(stats: WeaponStats) {
    const ammo = this.player.weaponStates[this.player.currentWeaponId];
    if (!ammo || ammo.reserve <= 0 || ammo.magazine >= stats.magazineSize || this.player.reloadTimer > 0) {
      return;
    }
    this.player.reloadTimer = stats.reloadTime;
    this.notify("Reloading", this.player.currentWeaponId.toUpperCase());
  }

  private finishReload(stats: WeaponStats) {
    const ammo = this.player.weaponStates[this.player.currentWeaponId];
    if (!ammo) {
      return;
    }
    const needed = stats.magazineSize - ammo.magazine;
    const moved = Math.min(needed, ammo.reserve);
    ammo.magazine += moved;
    ammo.reserve -= moved;
    this.player.reloadTimer = 0;
  }

  private fireWeapon(weapon: WeaponDefinition, stats: WeaponStats) {
    const ammo = this.player.weaponStates[this.player.currentWeaponId];
    if (!ammo || !this.camera) {
      return;
    }

    ammo.magazine -= 1;
    this.player.fireCooldown = 1 / stats.fireRate;
    this.player.reloadTimer = 0;
    const recoilScale = this.rightMouseDown ? 0.75 : 1;
    this.camera.rotation.x = Math.max(
      -1.2,
      Math.min(1.2, this.camera.rotation.x - stats.recoil * 0.0065 * recoilScale * randomBetween(0.9, 1.15)),
    );
    this.player.recoilYaw += randomBetween(-0.08, 0.08) * stats.recoil * recoilScale;
    this.player.recoilPitch += -0.14 * stats.recoil * recoilScale;
    this.player.weaponKick = Math.min(1, this.player.weaponKick + 0.34 + stats.recoil * 0.06);

    const pellets = stats.pellets ?? 1;
    let landedHit = false;
    for (let pelletIndex = 0; pelletIndex < pellets; pelletIndex += 1) {
      const spread = this.rightMouseDown ? stats.adsSpread : stats.spread;
      const direction = this.getAimDirection(spread);
      this.spawnTracer(this.player.position, direction, stats.range, weapon.accent, 0.045 + stats.recoil * 0.004);
      const hit = this.raycastEnemy(this.player.position, direction, stats.range);
      if (hit) {
        this.applyDamageToEnemy(hit.enemy, stats.damage, direction);
        landedHit = true;
      } else {
        const targetHit = this.raycastObjectiveTarget(this.player.position, direction, stats.range);
        if (targetHit) {
          this.handleObjectiveTargetHit(targetHit);
        }
      }
    }

    if (landedHit) {
      this.player.hitmarkerTimer = 1;
    }

    if (ammo.magazine <= 0) {
      this.beginReload(stats);
    }
  }

  private getAimDirection(spread: number) {
    if (!this.camera) {
      return new Vector3(0, 0, 1);
    }
    const yaw = this.camera.rotation.y + randomBetween(-spread, spread);
    const pitch = this.camera.rotation.x + randomBetween(-spread, spread);
    return new Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(-pitch),
      Math.cos(yaw) * Math.cos(pitch),
    ).normalize();
  }

  private raycastEnemy(origin: Vector3, direction: Vector3, maxDistance: number) {
    let bestHit: { enemy: RuntimeEnemy; distance: number } | undefined;
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }
      const toCenter = enemy.mesh.position.subtract(origin);
      const projection = Vector3.Dot(toCenter, direction);
      if (projection <= 0 || projection > maxDistance) {
        continue;
      }
      const closestPoint = origin.add(direction.scale(projection));
      const distanceFromRay = Vector3.Distance(closestPoint, enemy.mesh.position);
      const radius = 1.1 * enemy.definition.scale;
      if (distanceFromRay <= radius && !this.segmentHitsObstacle(origin, enemy.mesh.position)) {
        if (!bestHit || projection < bestHit.distance) {
          bestHit = {
            enemy,
            distance: projection,
          };
        }
      }
    }
    return bestHit;
  }

  private raycastObjectiveTarget(origin: Vector3, direction: Vector3, maxDistance: number) {
    let bestHit: ObjectiveTarget | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const target of this.objectiveTargets) {
      if (!target.alive) {
        continue;
      }
      const toCenter = target.mesh.position.subtract(origin);
      const projection = Vector3.Dot(toCenter, direction);
      if (projection <= 0 || projection > maxDistance) {
        continue;
      }
      const closestPoint = origin.add(direction.scale(projection));
      const distanceFromRay = Vector3.Distance(closestPoint, target.mesh.position);
      if (distanceFromRay <= 1.2 && projection < bestDistance && !this.segmentHitsObstacle(origin, target.mesh.position)) {
        bestDistance = projection;
        bestHit = target;
      }
    }
    return bestHit;
  }

  private applyDamageToEnemy(enemy: RuntimeEnemy, baseDamage: number, shotDirection: Vector3) {
    let finalDamage = baseDamage;
    if (enemy.definition.armorFrontMultiplier) {
      const forward = new Vector3(Math.sin(enemy.mesh.rotation.y), 0, Math.cos(enemy.mesh.rotation.y));
      const incoming = shotDirection.scale(-1);
      const dot = Vector3.Dot(forward.normalize(), incoming.normalize());
      if (dot > 0.35) {
        finalDamage *= enemy.definition.armorFrontMultiplier;
      }
    }

    enemy.health = Math.max(0, enemy.health - finalDamage);
    enemy.mesh.scaling = new Vector3(enemy.definition.scale, enemy.definition.scale * 0.97, enemy.definition.scale);

    if (this.settings.goreEnabled && this.scene) {
      const decal = MeshBuilder.CreatePlane(
        generateId("decal"),
        { size: randomBetween(0.35, 0.7) },
        this.scene,
      );
      const material = new StandardMaterial(generateId("blood"), this.scene);
      material.diffuseColor = new Color3(0.65, 0.08, 0.08);
      material.emissiveColor = new Color3(0.2, 0, 0);
      material.alpha = 0.78;
      decal.material = material;
      decal.billboardMode = Mesh.BILLBOARDMODE_ALL;
      decal.position = enemy.mesh.position.add(new Vector3(0, randomBetween(0.3, 1.5), 0));
      setTimeout(() => decal.dispose(), 800);
    }

    if (enemy.health <= 0) {
      this.killEnemy(enemy);
    } else if (enemy.definition.archetype === "boss-commander" && enemy.health < enemy.maxHealth * 0.55 && !enemy.spawnedReinforcements) {
      enemy.spawnedReinforcements = true;
      this.spawnEnemiesFromInline([
        { enemyId: "rifleman", x: enemy.mesh.position.x + 6, z: enemy.mesh.position.z + 3 },
        { enemyId: "rusher", x: enemy.mesh.position.x - 5, z: enemy.mesh.position.z - 3 },
      ], `${enemy.id}-reinforce`);
      this.notify("Boss Phase", "Commander Helix called in reinforcements.");
    } else if (enemy.definition.archetype === "boss-siege" && enemy.health < enemy.maxHealth * 0.5 && !enemy.spawnedReinforcements) {
      enemy.spawnedReinforcements = true;
      this.spawnEnemiesFromInline([
        { enemyId: "shield-heavy", x: enemy.mesh.position.x + 7, z: enemy.mesh.position.z + 5 },
        { enemyId: "rusher", x: enemy.mesh.position.x - 7, z: enemy.mesh.position.z + 4 },
        { enemyId: "rifleman", x: enemy.mesh.position.x, z: enemy.mesh.position.z + 9 },
      ], `${enemy.id}-support`);
      this.notify("Boss Phase", "Siege Breaker broke containment supports.");
    }
  }

  private killEnemy(enemy: RuntimeEnemy) {
    enemy.alive = false;
    enemy.mesh.dispose();
    enemy.shieldMesh?.dispose();
    this.runKills += 1;
    this.score += 100 + (enemy.definition.archetype.includes("boss") ? 500 : 0);
    this.profile.stats.totalKills += 1;
    this.profile.stats.missionKills += 1;
    this.profile.xp += enemy.definition.rewardXp;
    this.profile.credits += enemy.definition.rewardCredits;
    if (enemy.definition.archetype.includes("boss")) {
      this.profile.stats.bossKills += 1;
    }
    void this.persistProfile();
    this.unlockAchievement("first-blood");
    if (this.profile.stats.totalKills >= 100) {
      this.unlockAchievement("slayer");
    }
    if (enemy.definition.archetype === "boss-commander") {
      this.unlockAchievement("helix-down");
    }
    if (enemy.definition.archetype === "boss-siege") {
      this.unlockAchievement("iron-fall");
    }
  }

  private updateEnemies(dt: number) {
    const livingEnemies = this.enemies.filter((enemy) => enemy.alive);
    for (const enemy of livingEnemies) {
      enemy.stunTimer = Math.max(0, enemy.stunTimer - dt);
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      enemy.mesh.scaling = enemy.mesh.scaling.add(
        new Vector3(
          (enemy.definition.scale - enemy.mesh.scaling.x) * Math.min(1, dt * 8),
          (enemy.definition.scale - enemy.mesh.scaling.y) * Math.min(1, dt * 8),
          (enemy.definition.scale - enemy.mesh.scaling.z) * Math.min(1, dt * 8),
        ),
      );

      if (enemy.stunTimer > 0) {
        continue;
      }

      const toPlayer = this.player.position.subtract(enemy.mesh.position);
      const horizontal = new Vector3(toPlayer.x, 0, toPlayer.z);
      const distance = Math.max(0.001, horizontal.length());
      horizontal.normalize();
      enemy.mesh.rotation.y = Math.atan2(horizontal.x, horizontal.z);
      enemy.shieldMesh?.rotation.copyFrom(enemy.mesh.rotation);

      const shouldRetreat =
        (enemy.definition.archetype === "marksman" && distance < enemy.definition.preferredRange - 4) ||
        (enemy.definition.archetype === "rifleman" && distance < enemy.definition.preferredRange - 6);
      const shouldAdvance = distance > enemy.definition.preferredRange + 1.5 || enemy.definition.archetype === "rusher";
      let movement = Vector3.Zero();
      if (shouldAdvance) {
        movement = horizontal.scale(enemy.definition.moveSpeed * dt);
      } else if (shouldRetreat) {
        movement = horizontal.scale(-enemy.definition.moveSpeed * 0.75 * dt);
      } else if (enemy.definition.archetype !== "shield-heavy" && enemy.definition.archetype !== "juggernaut" && !enemy.definition.archetype.includes("boss")) {
        const strafe = new Vector3(horizontal.z, 0, -horizontal.x).scale(Math.sin(this.runTime + distance) * enemy.definition.moveSpeed * 0.55 * dt);
        movement = strafe;
      }

      const candidateX = this.resolveEnemyAxis(
        enemy.mesh.position.x,
        enemy.mesh.position.z,
        enemy.mesh.position.x + movement.x,
        "x",
      );
      const candidateZ = this.resolveEnemyAxis(
        candidateX,
        enemy.mesh.position.z,
        enemy.mesh.position.z + movement.z,
        "z",
      );
      enemy.mesh.position.x = candidateX;
      enemy.mesh.position.z = candidateZ;
      if (enemy.shieldMesh) {
        enemy.shieldMesh.position = enemy.mesh.position.add(new Vector3(0, 0.2, 0));
      }

      const hasSight = !this.segmentHitsObstacle(enemy.mesh.position, this.player.position);
      const attackRange = enemy.definition.preferredRange + (enemy.definition.archetype === "rusher" ? 1.5 : 4);
      if (distance <= attackRange && hasSight && enemy.attackCooldown <= 0) {
        enemy.attackCooldown = enemy.definition.attackCooldown;
        const damage =
          enemy.definition.attackDamage *
          0.42 *
          (enemy.definition.archetype === "boss-siege" && distance < 8 ? 1.25 : 1);
        const shotDirection = this.player.position.subtract(enemy.mesh.position).normalize();
        this.spawnTracer(enemy.mesh.position.add(new Vector3(0, 1.05, 0)), shotDirection, Math.min(attackRange, distance), enemy.definition.color, 0.03);
        this.damagePlayer(damage);
      }
    }

    if (this.bossBarEnemyId) {
      const boss = this.enemies.find((enemy) => enemy.id === this.bossBarEnemyId && enemy.alive);
      if (boss) {
        useHudStore.getState().setHud({
          bossName: boss.definition.name,
          bossHealth: boss.health,
          bossMaxHealth: boss.maxHealth,
        });
      } else {
        this.bossBarEnemyId = undefined;
        useHudStore.getState().setHud({
          bossHealth: undefined,
          bossMaxHealth: undefined,
          bossName: undefined,
        });
      }
    }
  }

  private resolveEnemyAxis(currentX: number, currentZ: number, nextValue: number, axis: "x" | "z") {
    const nextX = axis === "x" ? nextValue : currentX;
    const nextZ = axis === "z" ? nextValue : currentZ;
    for (const obstacle of this.obstacles) {
      if (
        nextX > obstacle.minX - 0.9 &&
        nextX < obstacle.maxX + 0.9 &&
        nextZ > obstacle.minZ - 0.9 &&
        nextZ < obstacle.maxZ + 0.9
      ) {
        return axis === "x" ? currentX : currentZ;
      }
    }
    return nextValue;
  }

  private damagePlayer(amount: number) {
    if (this.player.damageCooldown > 0) {
      return;
    }
    this.player.damageCooldown = 0.33;
    this.player.health = Math.max(0, this.player.health - amount);
    this.player.damageFlash = Math.min(1, this.player.damageFlash + amount / 30);
    if (this.player.health <= 0) {
      this.handlePlayerDeath();
    }
  }

  private handlePlayerDeath() {
    this.pause();
    this.missionFailed = true;
    this.player.checkpointDeaths += 1;

    if (this.activeMode === "survival") {
      this.finishRun(false, {
        title: "Survival Failed",
        summary: `Wave ${this.wave} reached in ${Math.round(this.runTime)}s.`,
        rewards: {
          xp: this.wave * 30,
          credits: this.wave * 20,
        },
        stats: [
          { label: "Wave", value: String(this.wave) },
          { label: "Score", value: String(this.score) },
          { label: "Kills", value: String(this.runKills) },
        ],
      });
      return;
    }

    this.notify("Agent Down", "Restart from checkpoint or return to command.");
  }

  private updateObjectiveState(dt: number) {
    if (!this.activeMission) {
      return;
    }

    const objective = this.activeMission.objectives[this.currentObjectiveIndex];
    if (!objective) {
      return;
    }

    switch (objective.kind) {
      case "clear-zone": {
        const aliveInGroup = this.enemies.some((enemy) => enemy.alive && objective.spawnIds?.includes(enemy.groupId));
        if (!aliveInGroup) {
          this.completeObjective();
        }
        break;
      }
      case "interact": {
        const distance = Vector3.Distance(this.player.position, flatten(objective.zone.x, objective.zone.z));
        if (distance > (objective.radius ?? 4)) {
          this.player.interactTimer = Math.max(0, this.player.interactTimer - dt * HOLD_DECAY);
        }
        if (this.player.interactTimer >= (objective.holdSeconds ?? 2)) {
          this.completeObjective();
        }
        break;
      }
      case "destroy-targets": {
        const aliveTargets = this.objectiveTargets.some((target) => target.alive && target.objectiveId === objective.id);
        if (!aliveTargets) {
          this.completeObjective();
        }
        break;
      }
      case "hold": {
        const distance = Vector3.Distance(this.player.position, flatten(objective.zone.x, objective.zone.z));
        if (distance <= (objective.radius ?? 6)) {
          this.currentObjectiveProgress += dt;
        } else {
          this.currentObjectiveProgress = Math.max(0, this.currentObjectiveProgress - dt * HOLD_DECAY);
        }
        if (this.currentObjectiveProgress >= (objective.holdSeconds ?? 10)) {
          this.completeObjective();
        }
        break;
      }
      case "boss": {
        const bossAlive = this.enemies.some((enemy) => enemy.alive && enemy.definition.archetype.includes("boss"));
        if (!bossAlive) {
          this.completeObjective();
        }
        break;
      }
      case "extract": {
        const distance = Vector3.Distance(this.player.position, flatten(objective.zone.x, objective.zone.z));
        const activeEnemies = this.enemies.some((enemy) => enemy.alive);
        if (distance <= (objective.radius ?? 5) && !activeEnemies) {
          this.completeObjective();
        }
        break;
      }
    }
  }

  private handleInteract(dt: number) {
    if (this.activeMode !== "campaign" || !this.activeMission) {
      return;
    }
    const objective = this.activeMission.objectives[this.currentObjectiveIndex];
    if (!objective || objective.kind !== "interact") {
      return;
    }
    const distance = Vector3.Distance(this.player.position, flatten(objective.zone.x, objective.zone.z));
    if (distance <= (objective.radius ?? 4)) {
      this.player.interactTimer += dt;
    }
  }

  private completeObjective() {
    if (!this.activeMission) {
      return;
    }

    this.currentObjectiveProgress = 0;
    this.player.interactTimer = 0;
    this.currentObjectiveIndex += 1;
    const nextObjective = this.activeMission.objectives[this.currentObjectiveIndex];
    this.objectiveTargets.forEach((target) => target.mesh.dispose());
    this.objectiveTargets = [];

    if (!nextObjective) {
      const rewards = {
        xp: this.activeMission.rewards.xp + (this.player.checkpointDeaths === 0 ? economyConfig.missionNoDeathBonus : 0),
        credits: this.activeMission.rewards.credits,
      };
      this.profile.xp += rewards.xp;
      this.profile.credits += rewards.credits;
      this.profile.stats.missionsCompleted += 1;
      this.profile.stats.missionKills = 0;
      if (!this.profile.campaign.completedMissionIds.includes(this.activeMission.id)) {
        this.profile.campaign.completedMissionIds.push(this.activeMission.id);
      }
      if (!this.profile.campaign.unlockedMissionIds.includes(this.activeMission.id)) {
        this.profile.campaign.unlockedMissionIds.push(this.activeMission.id);
      }
      const nextMission = campaignMissions.find((mission) => mission.unlockMissionId === this.activeMission?.id);
      if (nextMission && !this.profile.campaign.unlockedMissionIds.includes(nextMission.id)) {
        this.profile.campaign.unlockedMissionIds.push(nextMission.id);
      }

      this.unlockAchievement(
        this.activeMission.id === "dock-breach"
          ? "campaign-start"
          : this.activeMission.id === "foundry-blackout"
            ? "foundry-clear"
            : this.activeMission.id === "glassline"
              ? "glassline-clear"
              : "campaign-complete",
      );
      if (this.activeMission.id === "iron-vault") {
        this.unlockAchievement("campaign-complete");
      }
      if (this.player.checkpointDeaths === 0) {
        this.profile.stats.noDeathMissionCount += 1;
      }
      void this.persistProfile();

      this.finishRun(true, {
        title: `${this.activeMission.name} Complete`,
        summary: this.activeMission.narrative,
        rewards,
        stats: [
          { label: "Kills", value: String(this.runKills) },
          { label: "Time", value: `${Math.round(this.runTime)}s` },
          { label: "Score", value: String(this.score) },
        ],
      });
      return;
    }

    this.checkpoint = this.captureCheckpoint();
    this.createObjectiveArtifacts(nextObjective);
    this.spawnObjectiveEnemies(nextObjective.spawnIds ?? []);
    useHudStore.getState().setHud({ objective: nextObjective.label });
    this.notify("Objective Updated", nextObjective.label);
    void this.autosaveCheckpoint();
  }

  private updateSurvivalState(dt: number) {
    if (!this.activeMission || !this.activeSurvivalMap) {
      return;
    }

    if (this.enemies.every((enemy) => !enemy.alive)) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) {
        this.wave += 1;
        this.profile.stats.survivalBestWave = Math.max(this.profile.stats.survivalBestWave, this.wave);
        this.profile.xp += economyConfig.survivalWaveReward;
        this.profile.credits += economyConfig.survivalWaveReward;
        if (this.wave >= 5) {
          this.unlockAchievement("survival-initiate");
        }
        if (this.wave >= 10) {
          this.unlockAchievement("survival-veteran");
        }
        const roster = this.buildSurvivalWave(this.wave);
        this.spawnEnemiesFromInline(roster, `wave-${this.wave}`);
        this.waveDelay = WAVE_CLEAR_DELAY;
        this.notify(this.wave % 5 === 0 ? "Elite Wave" : "New Wave", `Wave ${this.wave}`);
      }
    } else {
      this.waveDelay = WAVE_CLEAR_DELAY;
    }
  }

  private buildSurvivalWave(wave: number) {
    const roster: Array<{ enemyId: string; x: number; z: number }> = [];
    const budget = 3 + wave;
    const enemyPool = ["rifleman", "rusher", "marksman"];
    if (wave >= 3) enemyPool.push("shield-heavy");
    if (wave >= 6) enemyPool.push("juggernaut");

    for (let i = 0; i < budget; i += 1) {
      const enemyId = enemyPool[Math.min(enemyPool.length - 1, Math.floor(Math.random() * enemyPool.length))];
      roster.push({
        enemyId,
        x: randomBetween(-24, 24),
        z: randomBetween(-28, 28),
      });
    }

    if (wave % 5 === 0) {
      roster.push({
        enemyId: wave >= 10 ? "boss-siege" : "juggernaut",
        x: 0,
        z: -18,
      });
      this.score += economyConfig.survivalEliteBonus * wave;
    }
    return roster;
  }

  private updateAreaEffects(dt: number) {
    const now = this.runTime;
    this.persistentAreaEffects = this.persistentAreaEffects.filter((effect) => {
      if (now >= effect.expiresAt) {
        effect.mesh.dispose();
        return false;
      }
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (Vector3.Distance(enemy.mesh.position, effect.mesh.position) <= 6) {
          enemy.health = Math.max(0, enemy.health - effect.dps * dt);
          if (enemy.health <= 0) {
            this.killEnemy(enemy);
          }
        }
      }
      return true;
    });
  }

  private createObjectiveArtifacts(objective?: MissionDefinition["objectives"][number]) {
    if (!objective || !this.scene) {
      return;
    }

    if (objective.kind === "interact") {
      const terminal = MeshBuilder.CreateBox(`terminal-${objective.id}`, { width: 1.2, height: 1.4, depth: 0.8 }, this.scene);
      const material = new StandardMaterial(`terminal-mat-${objective.id}`, this.scene);
      material.diffuseColor = new Color3(0.18, 0.18, 0.22);
      material.emissiveColor = new Color3(0.2, 0.9, 0.95);
      terminal.material = material;
      terminal.position = new Vector3(objective.zone.x, 0.8, objective.zone.z);
      this.objectiveTargets.push({
        id: objective.id,
        mesh: terminal,
        objectiveId: objective.id,
        alive: true,
      });
    }

    if (objective.kind === "destroy-targets") {
      for (let i = 0; i < (objective.targetCount ?? 1); i += 1) {
        const relay = MeshBuilder.CreateCylinder(
          `relay-${objective.id}-${i}`,
          { diameter: 1.25, height: 2.2, tessellation: 6 },
          this.scene,
        );
        const material = new StandardMaterial(`relay-mat-${objective.id}-${i}`, this.scene);
        material.diffuseColor = new Color3(0.25, 0.25, 0.3);
        material.emissiveColor = new Color3(1, 0.45, 0.15);
        relay.material = material;
        relay.position = new Vector3(objective.zone.x + i * 2.2, 1.2, objective.zone.z + i * -1.4);
        this.objectiveTargets.push({
          id: `${objective.id}-${i}`,
          mesh: relay,
          objectiveId: objective.id,
          alive: true,
        });
      }
    }
  }

  private handleObjectiveTargetHit(target: ObjectiveTarget) {
    target.alive = false;
    target.mesh.dispose();
  }

  private spawnObjectiveEnemies(groupIds: string[]) {
    if (!this.activeMission) {
      return;
    }

    for (const groupId of groupIds) {
      const group = this.activeMission.enemySpawns[groupId] ?? [];
      this.spawnEnemiesFromInline(group, groupId);
    }
  }

  private spawnEnemiesFromInline(spawns: Array<SpawnPoint & { enemyId: string }>, groupId: string) {
    if (!this.scene) {
      return;
    }
    for (const spawn of spawns) {
      const definition = enemyDefinitions.find((enemy) => enemy.id === spawn.enemyId);
      if (!definition) {
        continue;
      }
      const capsule = MeshBuilder.CreateCapsule(
        generateId("enemy"),
        {
          radius: 0.65 * definition.scale,
          height: 2.1 * definition.scale,
          tessellation: 8,
        },
        this.scene,
      );
      const material = new StandardMaterial(generateId("enemy-mat"), this.scene);
      material.diffuseColor = new Color3(0.18, 0.22, 0.28);
      material.specularColor = Color3.FromHexString(definition.color).scale(0.28);
      material.emissiveColor = Color3.FromHexString(definition.color).scale(0.18);
      capsule.material = material;
      capsule.position = new Vector3(spawn.x, 1.1 * definition.scale, spawn.z);
      capsule.rotation.y = Math.PI;

      const head = MeshBuilder.CreateSphere(generateId("enemy-head"), { diameter: 0.68 * definition.scale, segments: 8 }, this.scene);
      const headMat = new StandardMaterial(generateId("enemy-head-mat"), this.scene);
      headMat.diffuseColor = Color3.FromHexString(definition.color).scale(0.82);
      headMat.emissiveColor = Color3.FromHexString(definition.color).scale(0.32);
      head.material = headMat;
      head.parent = capsule;
      head.position = new Vector3(0, 1.1 * definition.scale, 0);

      let shieldMesh: Mesh | undefined;
      if (definition.archetype === "shield-heavy" || definition.archetype === "juggernaut" || definition.archetype === "boss-siege") {
        shieldMesh = MeshBuilder.CreateBox(generateId("shield"), { width: 1.3 * definition.scale, height: 1.6 * definition.scale, depth: 0.2 }, this.scene);
        const shieldMat = new StandardMaterial(generateId("shield-mat"), this.scene);
        shieldMat.diffuseColor = new Color3(0.15, 0.18, 0.2);
        shieldMat.emissiveColor = new Color3(0.08, 0.15, 0.18);
        shieldMesh.material = shieldMat;
        shieldMesh.position = capsule.position.add(new Vector3(0, 0.2, 0.8 * definition.scale));
      }

      const enemy: RuntimeEnemy = {
        id: generateId("enemy"),
        definition,
        mesh: capsule,
        shieldMesh,
        health: definition.health,
        maxHealth: definition.health,
        attackCooldown: 1 + Math.random(),
        stunTimer: 0,
        alive: true,
        groupId,
        spawnedReinforcements: false,
      };
      if (definition.archetype.includes("boss")) {
        this.bossBarEnemyId = enemy.id;
      }
      this.enemies.push(enemy);
    }
  }

  private segmentHitsObstacle(from: Vector3, to: Vector3) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    return this.obstacles.some((obstacle) => {
      let tMin = 0;
      let tMax = 1;

      if (Math.abs(dx) < 0.0001) {
        if (from.x < obstacle.minX || from.x > obstacle.maxX) {
          return false;
        }
      } else {
        const tx1 = (obstacle.minX - from.x) / dx;
        const tx2 = (obstacle.maxX - from.x) / dx;
        tMin = Math.max(tMin, Math.min(tx1, tx2));
        tMax = Math.min(tMax, Math.max(tx1, tx2));
      }

      if (Math.abs(dz) < 0.0001) {
        if (from.z < obstacle.minZ || from.z > obstacle.maxZ) {
          return false;
        }
      } else {
        const tz1 = (obstacle.minZ - from.z) / dz;
        const tz2 = (obstacle.maxZ - from.z) / dz;
        tMin = Math.max(tMin, Math.min(tz1, tz2));
        tMax = Math.min(tMax, Math.max(tz1, tz2));
      }

      return tMax >= tMin && tMax > 0.02 && tMin < 0.98;
    });
  }

  private updateWeaponViewModel(_dt: number) {
    if (!this.weaponRoot || !this.weaponBody) {
      return;
    }

    const moveIntensity = this.player.sprinting ? 1.25 : 0.85;
    const bob = this.settings.motionReduced ? 0 : Math.sin(this.player.movementPhase * 1.4) * 0.018 * moveIntensity;
    const sway = this.settings.motionReduced ? 0 : Math.cos(this.player.movementPhase * 0.7) * 0.012 * moveIntensity;
    const kick = this.player.weaponKick * 0.09;
    this.weaponRoot.position.x = 0.35 - this.player.adsWeight * 0.17 + sway;
    this.weaponRoot.position.y = -0.42 + this.player.adsWeight * 0.14 + bob + kick * 0.25;
    this.weaponRoot.position.z = 0.68 - this.player.adsWeight * 0.24 + kick;
    this.weaponRoot.rotation.y = -0.12 + this.player.adsWeight * 0.12 - sway * 2.4;
    this.weaponRoot.rotation.x = -0.03 - kick * 1.6;
  }

  private rebuildWeaponViewModel() {
    if (!this.weaponBody || !this.scene) {
      return;
    }
    const { weapon } = getAppliedWeaponStats(this.player.currentWeaponId, this.profile.loadout);
    const accent = weapon?.accent ?? "#cfd8e3";
    const material = new StandardMaterial(generateId("weapon-mat"), this.scene);
    material.diffuseColor = Color3.FromHexString(accent);
    material.emissiveColor = Color3.FromHexString(accent).scale(0.15);
    this.weaponBody.material = material;
    const depth = weapon?.archetype === "shotgun" ? 1 : weapon?.archetype === "dmr" ? 1.2 : weapon?.archetype === "smg" ? 0.58 : 0.82;
    this.weaponBody.scaling = new Vector3(1, 1, depth / 0.72);
  }

  private finishRun(victory: boolean, debrief: { title: string; summary: string; rewards: { xp: number; credits: number }; stats: Array<{ label: string; value: string }> }) {
    this.paused = true;
    this.exitPointerLock();
    if (victory) {
      this.profile.xp += debrief.rewards.xp;
      this.profile.credits += debrief.rewards.credits;
    } else {
      this.profile.xp += debrief.rewards.xp;
      this.profile.credits += debrief.rewards.credits;
    }
    useMenuStore.getState().setDebrief(debrief);
    useMenuStore.getState().setScreen("debrief");
    useHudStore.getState().setHud({ visible: false });
    void this.persistProfile();
  }

  private async autosaveCheckpoint() {
    if (!this.activeMode || !this.activeMission || !this.checkpoint) {
      return;
    }
    const autoslot: SaveSlotData = {
      version: 1,
      slotId: 1,
      label: `${this.activeMission.name} Autosave`,
      timestamp: new Date().toISOString(),
      mode: this.activeMode,
      missionOrMapId: this.activeMission.id,
      profileSnapshot: structuredClone(this.profile),
      checkpoint: this.checkpoint,
    };
    await saveSlot(autoslot);
    this.saveSlots[0] = autoslot;
    useSaveStore.getState().setSlots([...this.saveSlots]);
  }

  private async persistProfile() {
    useSaveStore.getState().setProfile(structuredClone(this.profile));
    await saveProfile(this.profile);
  }

  private notify(title: string, detail?: string) {
    const id = generateId("note");
    useHudStore.getState().pushNotification({ id, title, detail });
    setTimeout(() => useHudStore.getState().removeNotification(id), 2500);
  }

  private syncHud() {
    const { weapon, stats } = getAppliedWeaponStats(this.player.currentWeaponId, this.profile.loadout);
    const ammo = this.player.weaponStates[this.player.currentWeaponId] ?? { magazine: 0, reserve: 0 };
    const currentObjective =
      this.activeMode === "campaign"
        ? this.activeMission?.objectives[this.currentObjectiveIndex]?.label ?? "Awaiting objective"
        : `Survive Wave ${Math.max(1, this.wave)}`;
    useHudStore.getState().setHud({
      visible: !!this.activeMode && !this.paused,
      missionName:
        this.activeMode === "campaign"
          ? this.activeMission?.name ?? ""
          : this.activeSurvivalMap?.name ?? "",
      modeLabel: this.activeMode === "survival" ? "Survival" : "Campaign",
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      ammoInMag: ammo.magazine,
      ammoReserve: ammo.reserve,
      weaponName: weapon?.name ?? "",
      fireMode:
        weapon?.archetype === "dmr" || weapon?.archetype === "pistol"
          ? "Semi"
          : weapon?.archetype === "shotgun"
            ? "Pump"
            : "Auto",
      tacticalLabel: tacticalEquipment.find((item) => item.id === this.profile.loadout.tacticalId)?.name ?? "",
      lethalLabel: lethalEquipment.find((item) => item.id === this.profile.loadout.lethalId)?.name ?? "",
      tacticalCharges: this.player.tacticalCharges,
      lethalCharges: this.player.lethalCharges,
      wave: this.wave,
      score: this.score,
      xp: this.profile.xp,
      rank: getRankFromXp(this.profile.xp),
      credits: this.profile.credits,
      hitmarker: this.player.hitmarkerTimer,
      damageFlash: this.player.damageFlash,
      reticleSpread: 7 + (this.rightMouseDown ? 0 : 8) + (this.player.sprinting ? 10 : 0) + this.player.weaponKick * 20,
      objectiveProgress:
        this.activeMode === "campaign"
          ? this.activeMission?.objectives[this.currentObjectiveIndex]?.kind === "hold"
            ? Math.min(1, this.currentObjectiveProgress / (this.activeMission?.objectives[this.currentObjectiveIndex]?.holdSeconds ?? 1))
            : this.activeMission?.objectives[this.currentObjectiveIndex]?.kind === "interact"
              ? Math.min(1, this.player.interactTimer / (this.activeMission?.objectives[this.currentObjectiveIndex]?.holdSeconds ?? 1))
              : 0
          : 0,
      objectiveProgressLabel:
        this.activeMode === "campaign"
          ? this.activeMission?.objectives[this.currentObjectiveIndex]?.kind === "hold"
            ? "Holding Uplink"
            : this.activeMission?.objectives[this.currentObjectiveIndex]?.kind === "interact"
              ? "Interacting"
              : undefined
          : undefined,
      objective:
        this.activeMode === "campaign"
          ? `${currentObjective}${this.activeMission?.objectives[this.currentObjectiveIndex]?.kind === "hold" ? ` (${Math.floor(this.currentObjectiveProgress)}s)` : ""}`
          : currentObjective,
    });
  }

  private spawnTracer(origin: Vector3, direction: Vector3, distance: number, color: string, thickness: number) {
    if (!this.scene || !this.camera) {
      return;
    }
    const tracer = MeshBuilder.CreateBox(
      generateId("tracer"),
      {
        width: thickness,
        height: thickness,
        depth: Math.max(0.8, Math.min(distance, 18)),
      },
      this.scene,
    );
    const mat = new StandardMaterial(generateId("tracer-mat"), this.scene);
    mat.disableLighting = true;
    mat.emissiveColor = Color3.FromHexString(color);
    mat.alpha = 0.86;
    tracer.material = mat;
    tracer.position = origin.add(direction.scale(Math.max(1.4, Math.min(distance * 0.4, 7))));
    tracer.lookAt(tracer.position.add(direction));
    tracer.rotation.x += Math.PI / 2;
    setTimeout(() => tracer.dispose(), 70);
  }

  private unlockAchievement(achievementId: string) {
    const definition = achievements.find((item) => item.id === achievementId);
    if (!definition) {
      return;
    }
    const existing = this.profile.achievements[achievementId];
    if (existing?.unlocked) {
      return;
    }
    this.profile.achievements[achievementId] = {
      unlocked: true,
      unlockedAt: new Date().toISOString(),
    };
    this.profile.credits += definition.creditsReward;
    this.notify("Achievement Unlocked", definition.name);
  }

  private handleResize = () => {
    this.engine.resize();
  };

  private handlePointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    useMenuStore.getState().setPointerLock(this.pointerLocked);
  };

  private requestPointerLock() {
    if (!this.pointerLocked && this.activeMode) {
      if (navigator.webdriver) {
        return;
      }
      try {
        const maybePromise = this.canvas.requestPointerLock();
        if (maybePromise && typeof (maybePromise as Promise<void>).catch === "function") {
          void (maybePromise as Promise<void>).catch(() => undefined);
        }
      } catch {
        // Automated browser runs and some document states cannot enter pointer lock.
      }
    }
  }

  private exitPointerLock() {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  private handleCanvasClick = () => {
    if (this.activeMode && !this.paused) {
      this.requestPointerLock();
    }
  };

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.pointerLocked || !this.camera || this.paused) {
      return;
    }
    this.camera.rotation.y += event.movementX * 0.0024 * this.settings.mouseSensitivity;
    this.camera.rotation.x = Math.max(
      -1.35,
      Math.min(1.35, this.camera.rotation.x + event.movementY * 0.0018 * this.settings.mouseSensitivity),
    );
  };

  private handleMouseDown = (event: MouseEvent) => {
    if (event.button === 0) {
      this.mouseDown = true;
    }
    if (event.button === 2) {
      this.rightMouseDown = true;
    }
  };

  private handleMouseUp = (event: MouseEvent) => {
    if (event.button === 0) {
      this.mouseDown = false;
    }
    if (event.button === 2) {
      this.rightMouseDown = false;
    }
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    this.pressedKeys.add(event.key.toLowerCase());
    this.heldKeys.add(event.key.toLowerCase());

    if (event.key === "Escape") {
      if (this.activeMode && !this.paused) {
        this.pause();
      }
    }
    if (event.key.toLowerCase() === "f") {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void this.canvas.requestFullscreen();
      }
    }
    if (event.key.toLowerCase() === "1") {
      this.switchWeapon(this.profile.loadout.primaryId);
    }
    if (event.key.toLowerCase() === "2") {
      this.switchWeapon(this.profile.loadout.secondaryId);
    }
    if (event.key.toLowerCase() === "q") {
      this.useTactical();
    }
    if (event.key.toLowerCase() === "g") {
      this.useLethal();
    }
    if (event.key.toLowerCase() === "e") {
    }
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.key.toLowerCase());
    this.heldKeys.delete(event.key.toLowerCase());
  };

  private switchWeapon(weaponId: string) {
    if (this.player.currentWeaponId === weaponId) {
      return;
    }
    this.player.currentWeaponId = weaponId;
    this.player.reloadTimer = 0;
    this.rebuildWeaponViewModel();
  }

  private useTactical() {
    if (this.player.tacticalCharges <= 0 || this.player.tacticalCooldown > 0) {
      return;
    }
    const tactical = tacticalEquipment.find((item) => item.id === this.profile.loadout.tacticalId);
    if (!tactical) {
      return;
    }
    this.player.tacticalCharges -= 1;
    this.player.tacticalCooldown = tactical.cooldown;
    if (tactical.id === "stim") {
      const before = this.player.health;
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 38);
      this.player.speedBoostTimer = 4.5;
      if (before <= 25) {
        this.player.recentStimClutch = true;
        this.unlockAchievement("field-medic");
      }
      this.notify("Stim Applied", "Health restored.");
    } else if (tactical.id === "flash") {
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (Vector3.Distance(enemy.mesh.position, this.player.position) <= 12) {
          enemy.stunTimer = 3.5;
        }
      }
      this.notify("Flash Charge", "Nearby enemies disrupted.");
    }
  }

  private useLethal() {
    if (this.player.lethalCharges <= 0 || this.player.lethalCooldown > 0 || !this.camera || !this.scene) {
      return;
    }
    const lethal = lethalEquipment.find((item) => item.id === this.profile.loadout.lethalId);
    if (!lethal) {
      return;
    }
    this.player.lethalCharges -= 1;
    this.player.lethalCooldown = lethal.cooldown;
    const direction = this.getAimDirection(0.01);
    const impactPoint = this.player.position.add(direction.scale(10));
    if (lethal.id === "frag") {
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const distance = Vector3.Distance(enemy.mesh.position, impactPoint);
        if (distance <= 7) {
          this.applyDamageToEnemy(enemy, Math.max(20, 120 - distance * 12), direction);
        }
      }
      this.notify("Frag Out", "Explosive damage delivered.");
    } else if (lethal.id === "incendiary") {
      const zone = MeshBuilder.CreateCylinder(generateId("fire-zone"), { diameter: 8, height: 0.15, tessellation: 24 }, this.scene);
      const mat = new StandardMaterial(generateId("fire-mat"), this.scene);
      mat.diffuseColor = new Color3(1, 0.36, 0.12);
      mat.emissiveColor = new Color3(1, 0.18, 0.05);
      mat.alpha = 0.68;
      zone.material = mat;
      zone.position = new Vector3(impactPoint.x, 0.06, impactPoint.z);
      this.persistentAreaEffects.push({
        id: generateId("burn"),
        mesh: zone,
        expiresAt: this.runTime + 6,
        dps: 45,
      });
      this.notify("Incendiary", "Area denial active.");
    }
  }
}

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
    ironPulseRuntime?: GameRuntime;
  }
}
