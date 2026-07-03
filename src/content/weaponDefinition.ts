import { z } from "zod";

export const WeaponDefinitionSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  enabled: z.literal(false),
});

export type WeaponDefinition = z.infer<typeof WeaponDefinitionSchema>;

export const EmptyWeaponCatalogSchema = z.object({
  weapons: z.array(WeaponDefinitionSchema).length(0),
});

export type EmptyWeaponCatalog = z.infer<typeof EmptyWeaponCatalogSchema>;

export const emptyWeaponCatalog: EmptyWeaponCatalog = EmptyWeaponCatalogSchema.parse({
  weapons: [],
});
