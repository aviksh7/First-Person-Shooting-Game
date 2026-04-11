import { useEffect, useRef, useState } from "react";
import { createGameRuntime } from "../game/bootstrap/createGameRuntime";
import { HUD } from "../features/hud/HUD";
import { MenuLayer } from "../features/menus/MenuLayer";
import { useSaveStore } from "../game/ui-bridge/save-store";
import type { GameRuntime } from "../game/core/runtime/GameRuntime";

export const App = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [runtime, setRuntime] = useState<GameRuntime | null>(null);
  const ready = useSaveStore((state) => state.ready);

  useEffect(() => {
    let active = true;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    void createGameRuntime(canvas).then((createdRuntime) => {
      if (!active) {
        createdRuntime.dispose();
        return;
      }
      setRuntime(createdRuntime);
    });

    return () => {
      active = false;
      setRuntime((current) => {
        current?.dispose();
        return null;
      });
    };
  }, []);

  return (
    <div className="app-shell">
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="vignette" aria-hidden />
      <HUD />
      <MenuLayer runtime={runtime} />
      {!ready ? <div className="boot-loader">Initializing command grid...</div> : null}
    </div>
  );
};
