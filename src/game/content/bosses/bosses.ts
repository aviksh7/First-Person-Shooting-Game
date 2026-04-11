import type { BossDefinition } from "../../core/types/content";

export const bosses: BossDefinition[] = [
  {
    id: "commander-helix",
    name: "Commander Helix",
    enemyId: "boss-commander",
    intro: "A mobile elite commander pushing coordinated counter-attacks.",
    rewardXp: 280,
    rewardCredits: 180,
    achievementId: "helix-down",
  },
  {
    id: "siege-breaker",
    name: "Siege Breaker",
    enemyId: "boss-siege",
    intro: "A bunker-grade juggernaut with brute force suppression.",
    rewardXp: 420,
    rewardCredits: 320,
    achievementId: "iron-fall",
  },
];
