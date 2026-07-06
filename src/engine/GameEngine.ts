import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AssetManifestLoader } from "./AssetManifestLoader";
import { FixedTimestepLoop } from "./FixedTimestepLoop";
import { InputManager } from "./InputManager";
import { PerformanceStats, type PerfStats } from "./PerformanceStats";
import { PlayerCollisionBody } from "./PlayerCollisionBody";
import { PointerLockController } from "./PointerLockController";
import { createGreyboxScene } from "./createGreyboxScene";
import { EventBus } from "../game/EventBus";
import {
  PlayerController,
  type InputFrame,
  type PlayerDebugSnapshot,
  type PlayerEvents,
  type PlayerPosition,
} from "../game/player/PlayerController";
import { defaultMovementConfig, type MovementConfig } from "../game/player/movementConfig";

export interface PlayerRuntimeDebugSnapshot extends PlayerDebugSnapshot {
  readonly phase: string;
  readonly fixedTickCount: number;
  readonly lastInputFrame: InputFrame;
  readonly lastDisplacement: PlayerPosition;
}

const emptyInputFrame: InputFrame = Object.freeze({
  moveX: 0,
  moveY: 0,
  sprintHeld: false,
  jumpPressed: false,
  jumpHeld: false,
  dashPressed: false,
  dashHeld: false,
});

const zeroDisplacement: PlayerPosition = Object.freeze({ x: 0, y: 0, z: 0 });

interface GameEngineOptions {
  readonly onPauseRequested: () => void;
  readonly onPerfToggleRequested: () => void;
  readonly onPerfStats: (stats: PerfStats) => void;
  readonly onPlayerDebug: (snapshot: PlayerDebugSnapshot) => void;
  readonly movementConfig?: MovementConfig;
}

export class GameEngine {
  private readonly engine: Engine;
  private readonly scene;
  private readonly camera;
  private readonly inputManager: InputManager;
  private readonly pointerLock: PointerLockController;
  private readonly fixedLoop = new FixedTimestepLoop();
  private readonly performanceStats: PerformanceStats;
  private readonly assetManifestLoader = new AssetManifestLoader();
  private readonly playerEvents = new EventBus<PlayerEvents>();
  private readonly movementConfig: MovementConfig;
  private readonly playerController: PlayerController;
  private readonly playerCollisionBody: PlayerCollisionBody;
  private readonly cameraPosition = new Vector3(0, 0, 0);
  private readonly initialFeetPosition: PlayerPosition = { x: 0, y: 0, z: -6 };
  private isRunning = false;
  private isDisposed = false;
  private simulationActive = false;
  private simulationTimerId: number | undefined;
  private yawRadians = 0;
  private pitchRadians = 0;
  private fixedTickCount = 0;
  private lastInputFrame = emptyInputFrame;
  private lastDisplacement = zeroDisplacement;

  private readonly handleResize = (): void => {
    this.engine.resize();
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: GameEngineOptions,
  ) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    const greybox = createGreyboxScene(this.engine);
    this.movementConfig = options.movementConfig ?? defaultMovementConfig;
    this.scene = greybox.scene;
    this.camera = greybox.camera;
    this.camera.fov = (this.movementConfig.baseFovDegrees * Math.PI) / 180;
    this.playerController = new PlayerController({
      config: this.movementConfig,
      events: this.playerEvents,
      initialPosition: this.initialFeetPosition,
    });
    this.playerCollisionBody = new PlayerCollisionBody(
      this.scene,
      this.movementConfig,
      this.initialFeetPosition,
    );
    this.performanceStats = new PerformanceStats(this.engine, this.scene);
    this.inputManager = new InputManager({
      canvas,
      onPauseRequested: options.onPauseRequested,
      onPerfToggleRequested: options.onPerfToggleRequested,
      onPointerLockLost: options.onPauseRequested,
    });
    this.pointerLock = new PointerLockController(canvas);
    window.addEventListener("resize", this.handleResize);
    this.syncCameraToPlayer(this.initialFeetPosition);
    this.publishPlayerDebug();
  }

  async start(): Promise<void> {
    await this.assetManifestLoader.loadEmptyManifest();

    if (this.isDisposed || this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.fixedLoop.reset();
    this.engine.runRenderLoop(() => {
      this.applyMouseLook();
      this.syncCameraToPlayer(this.playerCollisionBody.getFeetPosition());
      this.scene.render();
      this.options.onPerfStats(this.performanceStats.sample());
    });
    this.simulationTimerId = window.setInterval(() => {
      this.fixedLoop.step(performance.now(), this.fixedUpdate);
    }, 1_000 / 60);
  }

  async requestPointerLock(): Promise<boolean> {
    return this.pointerLock.request();
  }

  releasePointerLock(): void {
    this.inputManager.reset();
    this.pointerLock.release();
  }

  setPlaying(isPlaying: boolean): void {
    this.simulationActive = isPlaying;
    if (!isPlaying) {
      this.inputManager.reset();
      this.lastInputFrame = emptyInputFrame;
    }
    this.publishPlayerDebug();
  }

  dispose(): void {
    this.isDisposed = true;
    this.engine.stopRenderLoop();
    if (this.simulationTimerId !== undefined) {
      window.clearInterval(this.simulationTimerId);
    }
    this.performanceStats.dispose();
    this.inputManager.dispose();
    window.removeEventListener("resize", this.handleResize);
    this.playerCollisionBody.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }

  private readonly fixedUpdate = (dtSeconds: number): void => {
    this.canvas.dataset.simulationTick = "60hz";
    if (!this.shouldSimulate()) {
      return;
    }

    this.fixedTickCount += 1;

    const groundReport = this.playerCollisionBody.getGroundReport();
    const inputFrame = this.inputManager.consumeInputFrame();
    this.lastInputFrame = inputFrame;
    const step = this.playerController.update(dtSeconds, inputFrame, this.yawRadians, groundReport);
    this.lastDisplacement = step.displacement;
    const collisionResult = this.playerCollisionBody.move(step.displacement);
    this.playerController.reconcilePosition(collisionResult.position, collisionResult.groundReport);
    this.publishPlayerDebug();
  };

  private applyMouseLook(): void {
    if (!this.shouldSimulate()) {
      this.inputManager.consumeMouseDelta();
      return;
    }

    const delta = this.inputManager.consumeMouseDelta();
    this.yawRadians += delta.x * this.movementConfig.mouseSensitivity;
    this.pitchRadians = Math.max(
      (-89 * Math.PI) / 180,
      Math.min((89 * Math.PI) / 180, this.pitchRadians + delta.y * this.movementConfig.mouseSensitivity),
    );
  }

  private syncCameraToPlayer(feetPosition: PlayerPosition): void {
    this.cameraPosition.set(feetPosition.x, feetPosition.y + this.movementConfig.eyeHeight, feetPosition.z);
    this.camera.position.copyFrom(this.cameraPosition);
    this.camera.rotation.set(this.pitchRadians, this.yawRadians, 0);
  }

  private publishPlayerDebug(): void {
    const snapshot: PlayerRuntimeDebugSnapshot = {
      ...this.playerController.getDebugSnapshot(),
      phase: window.__NULLPOINT_PHASE__ ?? "Boot",
      fixedTickCount: this.fixedTickCount,
      lastInputFrame: this.lastInputFrame,
      lastDisplacement: this.lastDisplacement,
    };
    this.options.onPlayerDebug(snapshot);
    window.__NULLPOINT_PLAYER__ = snapshot;
  }

  private shouldSimulate(): boolean {
    return this.simulationActive;
  }
}

declare global {
  interface Window {
    __NULLPOINT_PLAYER__?: PlayerRuntimeDebugSnapshot;
  }
}
