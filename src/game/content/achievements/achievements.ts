import type { AchievementDefinition } from "../../core/types/content";

export const achievements: AchievementDefinition[] = [
  { id: "first-blood", name: "First Blood", description: "Score your first elimination.", creditsReward: 40 },
  { id: "campaign-start", name: "Opening Move", description: "Complete Dock Breach.", creditsReward: 55 },
  { id: "foundry-clear", name: "Blackout", description: "Complete Foundry Blackout.", creditsReward: 65 },
  { id: "glassline-clear", name: "Skyline Breaker", description: "Complete Glassline.", creditsReward: 85 },
  { id: "campaign-complete", name: "Iron Pulse", description: "Finish the full launch campaign.", creditsReward: 180 },
  { id: "helix-down", name: "Helix Down", description: "Defeat Commander Helix.", creditsReward: 120 },
  { id: "iron-fall", name: "Iron Fall", description: "Defeat the Siege Breaker.", creditsReward: 160 },
  { id: "gunsmith", name: "Gunsmith", description: "Equip attachments in all four slots on one weapon.", creditsReward: 80 },
  { id: "field-medic", name: "Field Medic", description: "Use a stim under 25 health and survive.", creditsReward: 60 },
  { id: "survival-initiate", name: "Hold The Line", description: "Reach wave 5 in survival.", creditsReward: 70 },
  { id: "survival-veteran", name: "Never Enough", description: "Reach wave 10 in survival.", creditsReward: 110 },
  { id: "slayer", name: "Slayer", description: "Accumulate 100 total eliminations.", creditsReward: 100 },
];
