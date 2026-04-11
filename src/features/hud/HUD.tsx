import { useHudStore } from "../../game/ui-bridge/hud-store";

export const HUD = () => {
  const hud = useHudStore();

  if (!hud.visible) {
    return null;
  }

  return (
    <div className="hud">
      <div className="hud__top">
        <div className="hud__mission">
          <span className="hud__eyebrow">{hud.modeLabel}</span>
          <strong>{hud.missionName}</strong>
          <span>{hud.objective}</span>
        </div>
        <div className="hud__score">
          <span>Rank {hud.rank}</span>
          <strong>{hud.score.toLocaleString()}</strong>
          <span>{hud.credits} CR</span>
        </div>
      </div>

      {hud.bossName && hud.bossHealth !== undefined && hud.bossMaxHealth !== undefined ? (
        <div className="hud__boss">
          <span>{hud.bossName}</span>
          <div className="hud__boss-bar">
            <div
              className="hud__boss-fill"
              style={{ width: `${(hud.bossHealth / hud.bossMaxHealth) * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {hud.objectiveProgress > 0 ? (
        <div className="hud__objective-progress">
          <span>{hud.objectiveProgressLabel ?? "Objective Progress"}</span>
          <div className="hud__objective-bar">
            <div className="hud__objective-fill" style={{ width: `${hud.objectiveProgress * 100}%` }} />
          </div>
        </div>
      ) : null}

      <div
        className={`hud__reticle ${hud.hitmarker > 0 ? "is-hit" : ""}`}
        style={{ ["--spread" as string]: `${hud.reticleSpread}px` }}
        aria-hidden
      >
        <span className="hud__reticle-line hud__reticle-line--top" />
        <span className="hud__reticle-line hud__reticle-line--right" />
        <span className="hud__reticle-line hud__reticle-line--bottom" />
        <span className="hud__reticle-line hud__reticle-line--left" />
        {hud.hitmarker > 0 ? (
          <>
            <span className="hud__hit hud__hit--a" />
            <span className="hud__hit hud__hit--b" />
            <span className="hud__hit hud__hit--c" />
            <span className="hud__hit hud__hit--d" />
          </>
        ) : null}
      </div>

      <div className="hud__damage" style={{ opacity: Math.min(0.8, hud.damageFlash) }} />

      <div className="hud__bottom">
        <div className="hud__health">
          <span>Health</span>
          <strong>{Math.ceil(hud.health)}</strong>
          <div className="hud__meter">
            <div className="hud__meter-fill" style={{ width: `${(hud.health / hud.maxHealth) * 100}%` }} />
          </div>
        </div>
        <div className="hud__weapon">
          <span>{hud.weaponName}</span>
          <strong>
            {hud.ammoInMag} <small>/ {hud.ammoReserve}</small>
          </strong>
          <span>{hud.fireMode}</span>
        </div>
        <div className="hud__equipment">
          <div>
            <span>{hud.tacticalLabel}</span>
            <strong>{hud.tacticalCharges}</strong>
          </div>
          <div>
            <span>{hud.lethalLabel}</span>
            <strong>{hud.lethalCharges}</strong>
          </div>
        </div>
      </div>

      <div className="hud__notifications">
        {hud.notifications.slice(-3).map((notification) => (
          <div className="hud__notification" key={notification.id}>
            <strong>{notification.title}</strong>
            {notification.detail ? <span>{notification.detail}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
};
