import type { Engine } from "@babylonjs/core/Engines/engine";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import type { Scene } from "@babylonjs/core/scene";

export interface PerfStats {
  readonly fps: number;
  readonly drawCalls: number;
}

export class PerformanceStats {
  private readonly instrumentation: SceneInstrumentation;

  constructor(
    private readonly engine: Engine,
    scene: Scene,
  ) {
    this.instrumentation = new SceneInstrumentation(scene);
    this.instrumentation.captureFrameTime = false;
    this.instrumentation.captureRenderTime = false;
  }

  sample(): PerfStats {
    return {
      fps: Math.round(this.engine.getFps()),
      drawCalls: this.instrumentation.drawCallsCounter.current,
    };
  }

  dispose(): void {
    this.instrumentation.dispose();
  }
}
