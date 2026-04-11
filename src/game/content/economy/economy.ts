export const economyConfig = {
  rankXpStep: 400,
  survivalWaveReward: 65,
  survivalEliteBonus: 45,
  missionNoDeathBonus: 80,
};

export const getRankFromXp = (xp: number) => Math.max(1, Math.floor(xp / economyConfig.rankXpStep) + 1);
