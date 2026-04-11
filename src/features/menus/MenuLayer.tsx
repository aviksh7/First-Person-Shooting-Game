import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { achievements } from "../../game/content/achievements/achievements";
import { attachments } from "../../game/content/attachments/attachments";
import { campaignMissions, survivalMaps } from "../../game/content/missions/missions";
import { allEquipment, allWeapons } from "../../game/content/weapons/weapons";
import { getRankFromXp } from "../../game/content/economy/economy";
import type { AttachmentSlot, MenuScreen, PlayerLoadout } from "../../game/core/types/content";
import { useMenuStore } from "../../game/ui-bridge/menu-store";
import { useSaveStore } from "../../game/ui-bridge/save-store";
import { getAppliedWeaponStats } from "../../game/simulation/weapons/weapon-utils";
import type { GameRuntime } from "../../game/core/runtime/GameRuntime";

interface MenuLayerProps {
  runtime: GameRuntime | null;
}

const slotLabels: AttachmentSlot[] = ["optic", "muzzle", "magazine", "handling"];
const controls = [
  "WASD: Move",
  "Mouse: Look",
  "Left Click: Fire",
  "Right Click: Aim Down Sights",
  "Shift: Sprint",
  "Ctrl: Crouch",
  "Space: Jump",
  "R: Reload",
  "1 / 2: Swap Weapons",
  "Q: Tactical",
  "G: Lethal",
  "E: Interact",
  "Esc: Pause",
  "F: Fullscreen",
];

export const MenuLayer = ({ runtime }: MenuLayerProps) => {
  const menu = useMenuStore();
  const saveState = useSaveStore();
  const profile = saveState.profile;
  const settings = saveState.settings;

  const backTarget: MenuScreen = menu.paused ? "pause" : "main";

  const renderPanel = () => {
    if (!profile || !settings || !runtime) {
      return null;
    }

    switch (menu.screen) {
      case "main":
        return (
          <Panel title="IRON PULSE" eyebrow="Browser-First FPS">
            <p className="panel__lede">
              A campaign-first tactical shooter with layered progression, survival pressure, and modular graybox combat spaces.
            </p>
            <div className="panel__actions">
              <button onClick={() => menu.setScreen("campaign-select")}>Campaign</button>
              <button onClick={() => menu.setScreen("survival-select")}>Survival</button>
              <button onClick={() => menu.setScreen("loadout")}>Loadout</button>
              <button onClick={() => menu.setScreen("armory")}>Armory</button>
              <button onClick={() => menu.setScreen("achievements")}>Achievements</button>
              <button onClick={() => menu.setScreen("save-slots")}>Save Slots</button>
              <button onClick={() => menu.setScreen("settings")}>Settings</button>
            </div>
          </Panel>
        );
      case "campaign-select":
        return (
          <Panel title="Campaign Operations" eyebrow={`Rank ${getRankFromXp(profile.xp)}`}>
            <div className="card-grid">
              {campaignMissions.map((mission) => {
                const unlocked = profile.campaign.unlockedMissionIds.includes(mission.id);
                return (
                  <button
                    key={mission.id}
                    className="mode-card"
                    disabled={!unlocked}
                    onClick={() => {
                      if (!unlocked) return;
                      menu.setSelectedMissionId(mission.id);
                      menu.setScreen("mission-brief");
                    }}
                  >
                    <span>{mission.theme}</span>
                    <strong>{mission.name}</strong>
                    <small>{mission.description}</small>
                    <em>{unlocked ? "Ready" : "Locked"}</em>
                  </button>
                );
              })}
            </div>
            <button className="panel__back" onClick={() => menu.setScreen("main")}>
              Back
            </button>
          </Panel>
        );
      case "mission-brief": {
        const mission = campaignMissions.find((item) => item.id === menu.selectedMissionId);
        if (!mission) return null;
        return (
          <Panel title={mission.name} eyebrow={`Campaign | ${mission.theme}`}>
            <p className="panel__lede">{mission.narrative}</p>
            <div className="info-row">
              <div>
                <span>Recommended Rank</span>
                <strong>{mission.recommendedRank}</strong>
              </div>
              <div>
                <span>Rewards</span>
                <strong>
                  {mission.rewards.xp} XP / {mission.rewards.credits} CR
                </strong>
              </div>
            </div>
            <ul className="objective-list">
              {mission.objectives.map((objective) => (
                <li key={objective.id}>
                  <strong>{objective.label}</strong>
                  <span>{objective.description}</span>
                </li>
              ))}
            </ul>
            <div className="panel__actions">
              <button
                onClick={() => {
                  menu.setActiveMode("campaign");
                  menu.setScreen("loadout");
                }}
              >
                Configure Loadout
              </button>
              <button onClick={() => menu.setScreen("campaign-select")}>Back</button>
            </div>
          </Panel>
        );
      }
      case "survival-select":
        return (
          <Panel title="Survival Zones" eyebrow="Secondary Mode">
            <div className="card-grid">
              {survivalMaps.map((map) => (
                <button
                  key={map.id}
                  className="mode-card"
                  onClick={() => {
                    menu.setSelectedSurvivalId(map.id);
                    menu.setActiveMode("survival");
                    menu.setScreen("loadout");
                  }}
                >
                  <span>{map.theme}</span>
                  <strong>{map.name}</strong>
                  <small>{map.description}</small>
                  <em>Waves + elites</em>
                </button>
              ))}
            </div>
            <button className="panel__back" onClick={() => menu.setScreen("main")}>
              Back
            </button>
          </Panel>
        );
      case "loadout": {
        const startLabel = menu.activeMode === "survival" ? "Deploy To Survival" : "Launch Mission";
        return (
          <LoadoutPanel
            runtime={runtime}
            profile={profile}
            onBack={() => menu.setScreen(menu.activeMode === "survival" ? "survival-select" : "mission-brief")}
            onStart={() => {
              if (menu.activeMode === "survival" && menu.selectedSurvivalId) {
                runtime.startSurvivalMap(menu.selectedSurvivalId);
                return;
              }
              if (menu.selectedMissionId) {
                runtime.startCampaignMission(menu.selectedMissionId);
              }
            }}
            startLabel={startLabel}
          />
        );
      }
      case "armory":
        return (
          <ArmoryPanel
            runtime={runtime}
            profile={profile}
            onBack={() => menu.setScreen(backTarget)}
          />
        );
      case "achievements":
        return (
          <Panel title="Achievements" eyebrow={`${Object.values(profile.achievements).filter((item) => item.unlocked).length}/${achievements.length}`}>
            <div className="card-grid">
              {achievements.map((achievement) => {
                const unlocked = profile.achievements[achievement.id]?.unlocked;
                return (
                  <div key={achievement.id} className={`mode-card ${unlocked ? "is-unlocked" : ""}`}>
                    <span>{unlocked ? "Unlocked" : "Locked"}</span>
                    <strong>{achievement.name}</strong>
                    <small>{achievement.description}</small>
                    <em>{achievement.creditsReward} CR bonus</em>
                  </div>
                );
              })}
            </div>
            <button className="panel__back" onClick={() => menu.setScreen(backTarget)}>
              Back
            </button>
          </Panel>
        );
      case "settings":
        return (
          <Panel title="Combat Settings" eyebrow="Browser-first tuning">
            <div className="settings-grid">
              <label>
                <span>Graphics Preset</span>
                <select
                  value={settings.graphicsPreset}
                  onChange={(event) => void runtime.updateSettings({ graphicsPreset: event.target.value as typeof settings.graphicsPreset })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label>
                <span>Resolution Scale</span>
                <input
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.05}
                  value={settings.resolutionScale}
                  onChange={(event) => void runtime.updateSettings({ resolutionScale: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Mouse Sensitivity</span>
                <input
                  type="range"
                  min={0.4}
                  max={2}
                  step={0.05}
                  value={settings.mouseSensitivity}
                  onChange={(event) => void runtime.updateSettings({ mouseSensitivity: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Field of View</span>
                <input
                  type="range"
                  min={74}
                  max={108}
                  step={1}
                  value={settings.fov}
                  onChange={(event) => void runtime.updateSettings({ fov: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Master Volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.masterVolume}
                  onChange={(event) => void runtime.updateSettings({ masterVolume: Number(event.target.value) })}
                />
              </label>
              <label className="toggle">
                <span>Reduce Motion</span>
                <input
                  type="checkbox"
                  checked={settings.motionReduced}
                  onChange={(event) => void runtime.updateSettings({ motionReduced: event.target.checked })}
                />
              </label>
              <label className="toggle">
                <span>Gore Toggle</span>
                <input
                  type="checkbox"
                  checked={settings.goreEnabled}
                  onChange={(event) => void runtime.updateSettings({ goreEnabled: event.target.checked })}
                />
              </label>
            </div>
            <button className="panel__back" onClick={() => menu.setScreen(backTarget)}>
              Back
            </button>
          </Panel>
        );
      case "pause":
        return (
          <Panel title={menu.activeMode === "survival" ? "Survival Paused" : "Mission Paused"} eyebrow="In Operation">
            <div className="panel__actions">
              <button onClick={() => runtime.resume()}>Resume</button>
              <button onClick={() => runtime.restartFromCheckpoint()}>
                {menu.activeMode === "survival" ? "Restart Run" : "Restart Checkpoint"}
              </button>
              <button onClick={() => menu.setScreen("save-slots")}>Save / Load</button>
              <button onClick={() => menu.setScreen("settings")}>Settings</button>
              <button onClick={() => runtime.returnToMainMenu()}>Abort Operation</button>
            </div>
          </Panel>
        );
      case "save-slots":
        return (
          <Panel title="Save Slots" eyebrow={menu.paused ? "Run Management" : "Persistence"}>
            <div className="card-grid">
              {saveState.slots.map((slot, index) => (
                <div key={index + 1} className="mode-card is-static">
                  <span>Slot {index + 1}</span>
                  <strong>{slot?.label ?? "Empty Slot"}</strong>
                  <small>{slot?.timestamp ? new Date(slot.timestamp).toLocaleString() : "No saved run yet."}</small>
                  <div className="inline-actions">
                    <button onClick={() => void runtime.saveCurrentRun(index + 1)} disabled={!menu.paused && !menu.activeMode}>
                      Save
                    </button>
                    <button onClick={() => void runtime.loadRun(index + 1)} disabled={!slot}>
                      Load
                    </button>
                    <button onClick={() => void runtime.clearRunSlot(index + 1)} disabled={!slot}>
                      Clear
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button className="panel__back" onClick={() => menu.setScreen(backTarget)}>
              Back
            </button>
          </Panel>
        );
      case "debrief":
        return menu.debrief ? (
          <Panel title={menu.debrief.title} eyebrow="Debrief">
            <p className="panel__lede">{menu.debrief.summary}</p>
            <div className="info-row">
              <div>
                <span>XP</span>
                <strong>{menu.debrief.rewards.xp}</strong>
              </div>
              <div>
                <span>Credits</span>
                <strong>{menu.debrief.rewards.credits}</strong>
              </div>
            </div>
            <div className="stats-row">
              {menu.debrief.stats.map((stat) => (
                <div key={stat.label}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                runtime.returnToMainMenu();
                menu.setDebrief(undefined);
              }}
            >
              Return To Main Menu
            </button>
          </Panel>
        ) : null;
    }
  };

  if (menu.screen === "pause" && !menu.paused) {
    return null;
  }

  return (
    <div className="menu-layer">
      {renderPanel()}
    </div>
  );
};

const Panel = ({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) => (
  <section className="panel">
    <header className="panel__header">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
    </header>
    {children}
  </section>
);

const LoadoutPanel = ({
  runtime,
  profile,
  onBack,
  onStart,
  startLabel,
}: {
  runtime: GameRuntime;
  profile: NonNullable<ReturnType<typeof useSaveStore.getState>["profile"]>;
  onBack: () => void;
  onStart: () => void;
  startLabel: string;
}) => {
  const [draftLoadout, setDraftLoadout] = useState<PlayerLoadout>(() => structuredClone(profile.loadout));
  const selectedWeapon = useMemo(
    () => getAppliedWeaponStats(draftLoadout.primaryId, draftLoadout),
    [draftLoadout],
  );

  const applyLoadout = async () => {
    await runtime.setLoadout(draftLoadout);
    onStart();
  };

  return (
    <Panel title="Operator Loadout" eyebrow="Primary / Secondary / Tactical / Lethal">
      <div className="controls-panel">
        <div className="controls-panel__header">
          <span className="field-label">Keybinds</span>
          <strong>Review these before every run</strong>
        </div>
        <div className="controls-grid">
          {controls.map((control) => (
            <div key={control} className="controls-grid__item">
              {control}
            </div>
          ))}
        </div>
      </div>

      <div className="loadout-grid">
        <div>
          <span className="field-label">Primary</span>
          <select
            value={draftLoadout.primaryId}
            onChange={(event) =>
              setDraftLoadout((current) => ({
                ...current,
                primaryId: event.target.value,
              }))
            }
          >
            {runtime.getWeaponsByCategory("primary").map((weapon) => (
              <option key={weapon.id} value={weapon.id} disabled={!runtime.isWeaponUnlocked(weapon.id)}>
                {weapon.name} {!runtime.isWeaponUnlocked(weapon.id) ? "(Locked)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="field-label">Secondary</span>
          <select
            value={draftLoadout.secondaryId}
            onChange={(event) =>
              setDraftLoadout((current) => ({
                ...current,
                secondaryId: event.target.value,
              }))
            }
          >
            {runtime.getWeaponsByCategory("secondary").map((weapon) => (
              <option key={weapon.id} value={weapon.id} disabled={!runtime.isWeaponUnlocked(weapon.id)}>
                {weapon.name} {!runtime.isWeaponUnlocked(weapon.id) ? "(Locked)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="field-label">Tactical</span>
          <select
            value={draftLoadout.tacticalId}
            onChange={(event) =>
              setDraftLoadout((current) => ({
                ...current,
                tacticalId: event.target.value,
              }))
            }
          >
            {runtime.getTacticals().map((item) => (
              <option key={item.id} value={item.id} disabled={!runtime.isEquipmentUnlocked(item.id)}>
                {item.name} {!runtime.isEquipmentUnlocked(item.id) ? "(Locked)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="field-label">Lethal</span>
          <select
            value={draftLoadout.lethalId}
            onChange={(event) =>
              setDraftLoadout((current) => ({
                ...current,
                lethalId: event.target.value,
              }))
            }
          >
            {runtime.getLethals().map((item) => (
              <option key={item.id} value={item.id} disabled={!runtime.isEquipmentUnlocked(item.id)}>
                {item.name} {!runtime.isEquipmentUnlocked(item.id) ? "(Locked)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h2 className="section-heading">Primary Attachments</h2>
      <div className="card-grid card-grid--attachments">
        {slotLabels.map((slot) => (
          <label key={slot} className="mode-card is-static">
            <span>{slot}</span>
            <select
              value={draftLoadout.attachments[draftLoadout.primaryId]?.[slot] ?? ""}
              onChange={(event) =>
                setDraftLoadout((current) => ({
                  ...current,
                  attachments: {
                    ...current.attachments,
                    [current.primaryId]: {
                      ...(current.attachments[current.primaryId] ?? {}),
                      [slot]: event.target.value || undefined,
                    },
                  },
                }))
              }
            >
              <option value="">None</option>
              {runtime.getAttachmentsForSlot(slot).map((attachment) => (
                <option
                  key={attachment.id}
                  value={attachment.id}
                  disabled={!runtime.isAttachmentUnlocked(attachment.id)}
                >
                  {attachment.name} {!runtime.isAttachmentUnlocked(attachment.id) ? "(Locked)" : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="stats-row">
        <div>
          <span>Damage</span>
          <strong>{selectedWeapon.stats?.damage ?? "-"}</strong>
        </div>
        <div>
          <span>Fire Rate</span>
          <strong>{selectedWeapon.stats?.fireRate.toFixed(1) ?? "-"}</strong>
        </div>
        <div>
          <span>Magazine</span>
          <strong>{selectedWeapon.stats?.magazineSize ?? "-"}</strong>
        </div>
        <div>
          <span>Recoil</span>
          <strong>{selectedWeapon.stats?.recoil.toFixed(2) ?? "-"}</strong>
        </div>
      </div>

      <div className="panel__actions">
        <button onClick={() => void applyLoadout()}>{startLabel}</button>
        <button onClick={onBack}>Back</button>
      </div>
    </Panel>
  );
};

const ArmoryPanel = ({
  runtime,
  profile,
  onBack,
}: {
  runtime: GameRuntime;
  profile: NonNullable<ReturnType<typeof useSaveStore.getState>["profile"]>;
  onBack: () => void;
}) => {
  const unlockedAchievements = Object.values(profile.achievements).filter((item) => item.unlocked).length;

  return (
    <Panel title="Armory & Progression" eyebrow={`Rank ${getRankFromXp(profile.xp)} | ${profile.credits} CR`}>
      <div className="stats-row">
        <div>
          <span>XP</span>
          <strong>{profile.xp}</strong>
        </div>
        <div>
          <span>Kills</span>
          <strong>{profile.stats.totalKills}</strong>
        </div>
        <div>
          <span>Best Wave</span>
          <strong>{profile.stats.survivalBestWave}</strong>
        </div>
        <div>
          <span>Achievements</span>
          <strong>{unlockedAchievements}</strong>
        </div>
      </div>
      <div className="armory-sections">
        <h2 className="section-heading">Weapons</h2>
        <div className="card-grid">
          {allWeapons.map((weapon) => {
            const unlocked = runtime.isWeaponUnlocked(weapon.id);
            const canBuy = profile.xp >= weapon.unlockXp && profile.credits >= weapon.unlockCost;
            return (
              <div key={weapon.id} className={`mode-card is-static ${unlocked ? "is-unlocked" : ""}`}>
                <span>{weapon.category}</span>
                <strong>{weapon.name}</strong>
                <small>{weapon.description}</small>
                <em>
                  {unlocked ? "Unlocked" : `Need ${weapon.unlockXp} XP / ${weapon.unlockCost} CR`}
                </em>
                {!unlocked ? (
                  <button disabled={!canBuy} onClick={() => void runtime.purchaseWeapon(weapon.id)}>
                    Unlock
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <h2 className="section-heading">Attachments</h2>
        <div className="card-grid">
          {attachments.map((attachment) => {
            const unlocked = runtime.isAttachmentUnlocked(attachment.id);
            const canBuy = profile.xp >= attachment.unlockXp && profile.credits >= attachment.unlockCost;
            return (
              <div key={attachment.id} className={`mode-card is-static ${unlocked ? "is-unlocked" : ""}`}>
                <span>{attachment.slot}</span>
                <strong>{attachment.name}</strong>
                <small>{attachment.description}</small>
                <em>{unlocked ? "Unlocked" : `Need ${attachment.unlockXp} XP / ${attachment.unlockCost} CR`}</em>
                {!unlocked ? (
                  <button disabled={!canBuy} onClick={() => void runtime.purchaseAttachment(attachment.id)}>
                    Unlock
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <h2 className="section-heading">Equipment</h2>
        <div className="card-grid">
          {allEquipment.map((item) => {
            const unlocked = runtime.isEquipmentUnlocked(item.id);
            const canBuy = profile.xp >= item.unlockXp && profile.credits >= item.unlockCost;
            return (
              <div key={item.id} className={`mode-card is-static ${unlocked ? "is-unlocked" : ""}`}>
                <span>{item.category}</span>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
                <em>{unlocked ? "Unlocked" : `Need ${item.unlockXp} XP / ${item.unlockCost} CR`}</em>
                {!unlocked ? (
                  <button disabled={!canBuy} onClick={() => void runtime.purchaseEquipment(item.id)}>
                    Unlock
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <button className="panel__back" onClick={onBack}>
        Back
      </button>
    </Panel>
  );
};
