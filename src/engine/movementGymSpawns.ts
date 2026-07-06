import type { PlayerPosition } from "../game/player/PlayerController";

export const movementGymZoneIds = [
  "runway",
  "dash-lane",
  "stairs",
  "ramps",
  "gaps",
  "drops",
  "tight-geometry",
] as const;

export type MovementGymZoneId = (typeof movementGymZoneIds)[number];

export interface MovementGymSpawn {
  readonly id: MovementGymZoneId;
  readonly label: string;
  readonly position: PlayerPosition;
  readonly yawRadians: number;
}

export const defaultMovementGymSpawnId: MovementGymZoneId = "runway";

export const movementGymSpawns: Readonly<Record<MovementGymZoneId, MovementGymSpawn>> = {
  runway: {
    id: "runway",
    label: "Runway",
    position: { x: 0, y: 0, z: -24 },
    yawRadians: 0,
  },
  "dash-lane": {
    id: "dash-lane",
    label: "Dash lane",
    position: { x: 9, y: 0, z: -24 },
    yawRadians: 0,
  },
  stairs: {
    id: "stairs",
    label: "Stairs",
    position: { x: -9, y: 0, z: -22 },
    yawRadians: 0,
  },
  ramps: {
    id: "ramps",
    label: "Ramps",
    position: { x: -18, y: 0, z: -22 },
    yawRadians: 0,
  },
  gaps: {
    id: "gaps",
    label: "Gaps",
    position: { x: 18, y: 0, z: -24 },
    yawRadians: 0,
  },
  drops: {
    id: "drops",
    label: "Drop platforms",
    position: { x: 27, y: 1, z: -20 },
    yawRadians: 0,
  },
  "tight-geometry": {
    id: "tight-geometry",
    label: "Tight geometry",
    position: { x: -28, y: 0, z: -20 },
    yawRadians: 0,
  },
};

export function isMovementGymZoneId(value: string): value is MovementGymZoneId {
  return (movementGymZoneIds as readonly string[]).includes(value);
}

export function resolveMovementGymSpawn(spawnId: string | null | undefined): MovementGymSpawn {
  if (spawnId && isMovementGymZoneId(spawnId)) {
    return movementGymSpawns[spawnId];
  }

  return movementGymSpawns[defaultMovementGymSpawnId];
}

export function resolveMovementGymSpawnFromSearch(search: string, enableUrlSpawn: boolean): MovementGymSpawn {
  if (!enableUrlSpawn) {
    return movementGymSpawns[defaultMovementGymSpawnId];
  }

  return resolveMovementGymSpawn(new URLSearchParams(search).get("spawn"));
}
