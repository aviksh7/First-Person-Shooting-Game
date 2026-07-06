import { useEffect, useRef, useState } from "react";
import { createNullpointRuntime, type NullpointRuntime } from "../bridge/createNullpointRuntime";
import { GameOverlay } from "../ui/GameOverlay";

export function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<NullpointRuntime | null>(null);
  const [runtimeRevision, setRuntimeRevision] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || runtimeRef.current) {
      return undefined;
    }

    const runtime = createNullpointRuntime(canvas);
    runtimeRef.current = runtime;
    setRuntimeRevision((revision) => revision + 1);

    return () => {
      runtime.dispose();
      if (runtimeRef.current === runtime) {
        runtimeRef.current = null;
      }
      setRuntimeRevision((revision) => revision + 1);
    };
  }, []);

  const commands = runtimeRef.current?.commands ?? null;

  return (
    <main className="appShell">
      <canvas ref={canvasRef} className="gameCanvas" data-testid="game-canvas" />
      <GameOverlay key={runtimeRevision} commands={commands} />
    </main>
  );
}
