import { useEffect, useRef, useState } from "react";
import { createNullpointRuntime, type NullpointRuntime } from "../bridge/createNullpointRuntime";
import type { UiCommands } from "../bridge/commands";
import { GameOverlay } from "../ui/GameOverlay";

export function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<NullpointRuntime | null>(null);
  const [commands, setCommands] = useState<UiCommands | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || runtimeRef.current) {
      return undefined;
    }

    const runtime = createNullpointRuntime(canvas);
    runtimeRef.current = runtime;
    setCommands(runtime.commands);

    return () => {
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  return (
    <main className="appShell">
      <canvas ref={canvasRef} className="gameCanvas" data-testid="game-canvas" />
      <GameOverlay commands={commands} />
    </main>
  );
}
