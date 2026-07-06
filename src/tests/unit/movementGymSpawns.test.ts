import { describe, expect, it } from "vitest";
import {
  defaultMovementGymSpawnId,
  movementGymSpawns,
  movementGymZoneIds,
  resolveMovementGymSpawn,
  resolveMovementGymSpawnFromSearch,
} from "../../engine/movementGymSpawns";

describe("movementGymSpawns", () => {
  it("has a spawn for every movement gym zone", () => {
    movementGymZoneIds.forEach((zoneId) => {
      expect(movementGymSpawns[zoneId].id).toBe(zoneId);
    });
  });

  it("keeps the default spawn valid", () => {
    expect(movementGymSpawns[defaultMovementGymSpawnId]).toBeDefined();
    expect(resolveMovementGymSpawn(undefined).id).toBe(defaultMovementGymSpawnId);
  });

  it("falls back safely for invalid spawn ids", () => {
    expect(resolveMovementGymSpawn("unknown-zone").id).toBe(defaultMovementGymSpawnId);
    expect(resolveMovementGymSpawnFromSearch("?spawn=bad-zone", true).id).toBe(defaultMovementGymSpawnId);
  });

  it("uses URL spawn only when dev support is enabled", () => {
    expect(resolveMovementGymSpawnFromSearch("?spawn=ramps", true).id).toBe("ramps");
    expect(resolveMovementGymSpawnFromSearch("?spawn=ramps", false).id).toBe(defaultMovementGymSpawnId);
  });
});
