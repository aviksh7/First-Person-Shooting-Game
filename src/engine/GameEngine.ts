import { Engine } from "@babylonjs/core/Engines/engine";
import { AssetManifestLoader } from "./AssetManifestLoader";
import { FixedTimestepLoop } from "./FixedTimestepLoop";
import { InputManager } from "./InputManager";
import { PerformanceStats, type PerfStats } from "./PerformanceStats";
import { PointerLockController } from "./PointerLockController";
import { createGreyboxScene } from "./createGreyboxScene";

interface GameEngineOptions {
  readonly onPauseRequested: () => void;
  readonly onPerfToggleRequested: () => void;
  readonly onPerfStats: (stats: PerfStats) => void;
}

export class GameEngine {
  private readonly engine: Engine;
  private readonly scene;
  private readonly inputManager: InputManager;
  private readonly pointerLock: PointerLockController;
  private readonly fixedLoop = new FixedTimestepLoop();
  private readonly performanceStats: PerformanceStats;
  private readonly assetManifestLoader = new AssetManifestLoader();
  private isRunning = false;

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
    this.scene = createGreyboxScene(this.engine, canvas);
    this.performanceStats = new PerformanceStats(this.engine, this.scene);
    this.inputManager = new InputManager({
      onPauseRequested: options.onPauseRequested,
      onPerfToggleRequested: options.onPerfToggleRequested,
    });
    this.pointerLock = new PointerLockController(canvas);
    window.addEventListener("resize", this.handleResize);
  }

  async start(): Promise<void> {
    await this.assetManifestLoader.loadEmptyManifest();

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.fixedLoop.reset();
    this.engine.runRenderLoop(() => {
      this.fixedLoop.step(performance.now(), this.fixedUpdate);
      this.scene.render();
      this.options.onPerfStats(this.performanceStats.sample());
    });
  }

  async requestPointerLock(): Promise<boolean> {
    return this.pointerLock.request();
  }

  releasePointerLock(): void {
    this.pointerLock.release();
  }

  dispose(): void {
    this.engine.stopRenderLoop();
    this.performanceStats.dispose();
    this.inputManager.dispose();
    window.removeEventListener("resize", this.handleResize);
    this.scene.dispose();
    this.engine.dispose();
  }

  private readonly fixedUpdate = (): void => {
    this.canvas.dataset.simulationTick = "60hz";
  };
}
