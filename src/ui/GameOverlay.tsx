import type { UiCommands } from "../bridge/commands";
import { useUiStore } from "../bridge/uiStore";

interface GameOverlayProps {
  readonly commands: UiCommands | null;
}

export function GameOverlay({ commands }: GameOverlayProps): JSX.Element {
  const phase = useUiStore((state) => state.phase);
  const perfStats = useUiStore((state) => state.perfStats);
  const playerDebug = useUiStore((state) => state.playerDebug);
  const isPerfOverlayVisible = useUiStore((state) => state.isPerfOverlayVisible);

  return (
    <div className="overlay" data-phase={phase}>
      {phase === "Menu" ? (
        <section className="titleScreen" data-testid="title-screen">
          <p className="eyebrow">Sprint 1A Controller</p>
          <h1>NULLPOINT</h1>
          <button
            className="primaryAction"
            data-testid="play-button"
            disabled={!commands}
            type="button"
            onClick={() => {
              void commands?.requestPlay();
            }}
          >
            Play
          </button>
        </section>
      ) : null}

      {phase === "Paused" ? (
        <section className="pauseOverlay" data-testid="pause-overlay">
          <h2>Paused</h2>
          <button
            className="primaryAction"
            type="button"
            onClick={() => {
              void commands?.requestResume();
            }}
          >
            Resume
          </button>
        </section>
      ) : null}

      {isPerfOverlayVisible ? (
        <aside className="perfOverlay" data-testid="perf-overlay">
          <span>FPS {perfStats.fps}</span>
          <span>Draw calls {perfStats.drawCalls}</span>
          {playerDebug ? (
            <>
              <span>State {playerDebug.state}</span>
              <span>Speed {playerDebug.horizontalSpeed.toFixed(2)} m/s</span>
              <span>Grounded {playerDebug.grounded ? "yes" : "no"}</span>
              <span>Dash {playerDebug.dashCooldownRemaining.toFixed(2)} s</span>
              <span>
                Pos {playerDebug.position.x.toFixed(1)}, {playerDebug.position.y.toFixed(1)},{" "}
                {playerDebug.position.z.toFixed(1)}
              </span>
            </>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
