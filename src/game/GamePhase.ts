export const gamePhases = ["Boot", "Menu", "Playing", "Paused", "Results"] as const;

export type GamePhase = (typeof gamePhases)[number];
