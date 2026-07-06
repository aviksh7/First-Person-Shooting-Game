import { describe, expect, it } from "vitest";
import {
  EmptyWeaponCatalogSchema,
  WeaponDefinitionSchema,
  emptyWeaponCatalog,
} from "../../content/weaponDefinition";

describe("content schemas", () => {
  it("validates the empty weapon catalog", () => {
    expect(EmptyWeaponCatalogSchema.parse(emptyWeaponCatalog)).toEqual({ weapons: [] });
  });

  it("keeps future weapon definitions disabled by default contract", () => {
    expect(
      WeaponDefinitionSchema.safeParse({ id: "placeholder", displayName: "Placeholder", enabled: true })
        .success,
    ).toBe(false);
  });
});
