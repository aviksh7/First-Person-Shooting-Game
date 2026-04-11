import { attachments } from "../../content/attachments/attachments";
import { allWeapons } from "../../content/weapons/weapons";
import type { AttachmentSlot, PlayerLoadout, WeaponDefinition, WeaponStats } from "../../core/types/content";

const clampMinimums: Record<keyof WeaponStats, number> = {
  damage: 1,
  fireRate: 0.2,
  magazineSize: 1,
  reserveAmmo: 0,
  reloadTime: 0.3,
  spread: 0.001,
  adsSpread: 0.001,
  range: 4,
  moveSpeedMultiplier: 0.45,
  adsMoveSpeedMultiplier: 0.35,
  adsTime: 0.05,
  recoil: 0.05,
  pellets: 1,
};

export const getWeaponById = (weaponId: string) => allWeapons.find((weapon) => weapon.id === weaponId);

export const getAppliedWeaponStats = (
  weaponId: string,
  loadout: PlayerLoadout,
): { weapon?: WeaponDefinition; stats?: WeaponStats } => {
  const weapon = getWeaponById(weaponId);
  if (!weapon) {
    return {};
  }

  const selectedAttachments = loadout.attachments[weaponId] ?? {};
  const nextStats: WeaponStats = {
    ...weapon.stats,
  };

  for (const slot of weapon.slots) {
    const attachmentId = selectedAttachments[slot];
    if (!attachmentId) {
      continue;
    }

    const attachment = attachments.find((item) => item.id === attachmentId);
    if (!attachment) {
      continue;
    }

    for (const [key, rawValue] of Object.entries(attachment.modifiers)) {
      const statKey = key as keyof WeaponStats;
      const current = nextStats[statKey];
      if (typeof current === "number" && typeof rawValue === "number") {
        const minimum = clampMinimums[statKey] as number;
        (nextStats as unknown as Record<string, number | undefined>)[statKey] = Math.max(minimum, current + rawValue);
      }
    }
  }

  nextStats.magazineSize = Math.round(nextStats.magazineSize);
  nextStats.reserveAmmo = Math.round(nextStats.reserveAmmo);
  nextStats.pellets = Math.round(nextStats.pellets ?? weapon.stats.pellets ?? 1);

  return {
    weapon,
    stats: nextStats,
  };
};

export const getAttachmentSelectionCount = (
  attachmentMap: Partial<Record<AttachmentSlot, string>> | undefined,
) =>
  Object.values(attachmentMap ?? {}).filter(Boolean).length;
