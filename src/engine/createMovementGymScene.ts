import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { movementGymSpawns } from "./movementGymSpawns";

export interface MovementGymScene {
  readonly scene: Scene;
  readonly camera: UniversalCamera;
}

interface GymMaterials {
  readonly floor: StandardMaterial;
  readonly marker: StandardMaterial;
  readonly dash: StandardMaterial;
  readonly step: StandardMaterial;
  readonly ramp: StandardMaterial;
  readonly gap: StandardMaterial;
  readonly drop: StandardMaterial;
  readonly wall: StandardMaterial;
  readonly hazard: StandardMaterial;
}

const enableCollision = (mesh: AbstractMesh): AbstractMesh => {
  mesh.checkCollisions = true;
  return mesh;
};

const createMaterial = (scene: Scene, name: string, color: Color3): StandardMaterial => {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = new Color3(0.04, 0.04, 0.04);
  return material;
};

const createSlab = (
  scene: Scene,
  name: string,
  width: number,
  depth: number,
  position: Vector3,
  material: StandardMaterial,
): AbstractMesh => {
  const slab = MeshBuilder.CreateBox(name, { width, depth, height: 0.2 }, scene);
  slab.position = position;
  slab.material = material;
  return enableCollision(slab);
};

const createBlock = (
  scene: Scene,
  name: string,
  width: number,
  height: number,
  depth: number,
  position: Vector3,
  material: StandardMaterial,
): AbstractMesh => {
  const block = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
  block.position = position;
  block.material = material;
  return enableCollision(block);
};

const createRamp = (
  scene: Scene,
  name: string,
  x: number,
  z: number,
  slopeDegrees: number,
  material: StandardMaterial,
): void => {
  const angle = (slopeDegrees * Math.PI) / 180;
  const depth = 8;
  const ramp = createBlock(
    scene,
    name,
    4,
    0.25,
    depth,
    new Vector3(x, Math.sin(angle) * depth * 0.5, z + Math.cos(angle) * depth * 0.5),
    material,
  );
  ramp.rotation.x = angle;
};

const createMaterials = (scene: Scene): GymMaterials => ({
  floor: createMaterial(scene, "gym-floor-material", new Color3(0.33, 0.35, 0.34)),
  marker: createMaterial(scene, "gym-marker-material", new Color3(0.85, 0.8, 0.38)),
  dash: createMaterial(scene, "gym-dash-material", new Color3(0.32, 0.55, 0.62)),
  step: createMaterial(scene, "gym-step-material", new Color3(0.52, 0.48, 0.62)),
  ramp: createMaterial(scene, "gym-ramp-material", new Color3(0.42, 0.57, 0.42)),
  gap: createMaterial(scene, "gym-gap-material", new Color3(0.47, 0.42, 0.35)),
  drop: createMaterial(scene, "gym-drop-material", new Color3(0.6, 0.46, 0.34)),
  wall: createMaterial(scene, "gym-wall-material", new Color3(0.2, 0.22, 0.24)),
  hazard: createMaterial(scene, "gym-hazard-material", new Color3(0.62, 0.28, 0.28)),
});

export function createMovementGymScene(engine: Engine): MovementGymScene {
  const scene = new Scene(engine);
  scene.collisionsEnabled = true;
  scene.clearColor = new Color4(0.035, 0.04, 0.045, 1);
  scene.fogMode = Scene.FOGMODE_EXP;
  scene.fogDensity = 0.009;
  scene.fogColor = new Color3(0.12, 0.13, 0.14);

  const spawn = movementGymSpawns.runway;
  const camera = new UniversalCamera(
    "player-camera",
    new Vector3(spawn.position.x, spawn.position.y + 1.65, spawn.position.z),
    scene,
  );
  camera.minZ = 0.03;
  scene.activeCamera = camera;

  const hemiLight = new HemisphericLight("hemi-light", new Vector3(0, 1, 0), scene);
  hemiLight.intensity = 0.68;

  const directionalLight = new DirectionalLight("directional-light", new Vector3(-0.45, -1, 0.35), scene);
  directionalLight.intensity = 0.35;

  const materials = createMaterials(scene);

  createSlab(scene, "runway-floor", 5, 58, new Vector3(0, -0.1, 4), materials.floor);
  for (let markerIndex = 0; markerIndex <= 10; markerIndex += 1) {
    const z = -20 + markerIndex * 5;
    createBlock(scene, `runway-distance-marker-${markerIndex * 5}m`, 5.2, 0.06, 0.12, new Vector3(0, 0.03, z), materials.marker);
  }

  createSlab(scene, "dash-lane-floor", 5, 62, new Vector3(9, -0.1, 5), materials.dash);
  createBlock(scene, "dash-lane-start-marker", 5.2, 0.08, 0.16, new Vector3(9, 0.04, -18), materials.marker);
  createBlock(scene, "dash-lane-overspeed-marker", 5.2, 0.08, 0.16, new Vector3(9, 0.04, 4), materials.marker);
  createBlock(scene, "dash-lane-decay-marker", 5.2, 0.08, 0.16, new Vector3(9, 0.04, 18), materials.marker);

  createSlab(scene, "stairs-approach-floor", 5, 48, new Vector3(-9, -0.1, 0), materials.floor);
  [0.15, 0.25, 0.35, 0.5].forEach((height, index) => {
    const z = -12 + index * 6;
    createBlock(scene, `step-test-${height.toFixed(2)}m`, 4, height, 1.8, new Vector3(-9, height * 0.5, z), materials.step);
  });

  createSlab(scene, "ramps-approach-floor", 5, 54, new Vector3(-18, -0.1, 2), materials.floor);
  [20, 35, 44, 55].forEach((slopeDegrees, index) => {
    createRamp(scene, `ramp-test-${slopeDegrees}deg`, -18, -18 + index * 11, slopeDegrees, materials.ramp);
  });

  createSlab(scene, "gaps-start-platform", 5, 8, new Vector3(18, -0.1, -22), materials.gap);
  const gapDefinitions = [
    { name: "gap-2-5m", gap: 2.5, z: -15 },
    { name: "gap-4-5m", gap: 4.5, z: -4 },
    { name: "gap-6-5m", gap: 6.5, z: 10 },
  ] as const;
  gapDefinitions.forEach(({ name, gap, z }) => {
    createSlab(scene, `${name}-near-platform`, 5, 3, new Vector3(18, -0.1, z), materials.gap);
    createSlab(scene, `${name}-catch-pit`, 5, gap, new Vector3(18, -1.1, z + 1.5 + gap * 0.5), materials.hazard);
    createSlab(scene, `${name}-far-platform`, 5, 5, new Vector3(18, -0.1, z + 3 + gap), materials.gap);
  });

  createSlab(scene, "drop-zone-catch-floor", 6, 44, new Vector3(27, -0.1, 0), materials.floor);
  [
    { name: "drop-1m-platform", height: 1, z: -18 },
    { name: "drop-2m-platform", height: 2, z: -6 },
    { name: "drop-4m-platform", height: 4, z: 8 },
  ].forEach(({ name, height, z }) => {
    createBlock(scene, name, 5, 0.25, 5, new Vector3(27, height - 0.125, z), materials.drop);
    createBlock(scene, `${name}-exit-ramp`, 4, 0.25, 5, new Vector3(27, height * 0.5 - 0.1, z + 5), materials.ramp).rotation.x =
      Math.atan2(height, 5);
  });

  createSlab(scene, "tight-geometry-floor", 6, 36, new Vector3(-28, -0.1, -4), materials.floor);
  createBlock(scene, "tight-corridor-left-wall", 0.35, 2.6, 16, new Vector3(-30.2, 1.3, -10), materials.wall);
  createBlock(scene, "tight-corridor-right-wall", 0.35, 2.6, 16, new Vector3(-25.8, 1.3, -10), materials.wall);
  createBlock(scene, "doorway-left-jamb", 0.4, 2.6, 0.5, new Vector3(-29.2, 1.3, 1), materials.wall);
  createBlock(scene, "doorway-right-jamb", 0.4, 2.6, 0.5, new Vector3(-26.8, 1.3, 1), materials.wall);
  createBlock(scene, "corner-corridor-back-wall", 4.8, 2.6, 0.35, new Vector3(-28.4, 1.3, 6), materials.wall);
  createBlock(scene, "corner-corridor-side-wall", 0.35, 2.6, 8, new Vector3(-25.8, 1.3, 4), materials.wall);
  createBlock(scene, "head-bump-bar", 4.6, 0.28, 0.6, new Vector3(-28, 2.15, -1.5), materials.hazard);

  return { scene, camera };
}
