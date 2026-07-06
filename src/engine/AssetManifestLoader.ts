export interface AssetManifest {
  readonly meshes: readonly string[];
  readonly textures: readonly string[];
  readonly audio: readonly string[];
}

export class AssetManifestLoader {
  async loadEmptyManifest(): Promise<AssetManifest> {
    return {
      meshes: [],
      textures: [],
      audio: [],
    };
  }
}
