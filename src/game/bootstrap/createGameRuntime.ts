import { GameRuntime } from "../core/runtime/GameRuntime";

export const createGameRuntime = async (canvas: HTMLCanvasElement) => {
  const runtime = new GameRuntime(canvas);
  await runtime.whenReady();
  return runtime;
};
