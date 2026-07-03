import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";

export function createGreyboxScene(engine: Engine, canvas: HTMLCanvasElement): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.035, 0.04, 0.045, 1);
  scene.fogMode = Scene.FOGMODE_EXP;
  scene.fogDensity = 0.018;
  scene.fogColor = new Color3(0.12, 0.13, 0.14);

  const camera = new UniversalCamera("debug-camera", new Vector3(0, 2.2, -8), scene);
  camera.setTarget(new Vector3(0, 1.6, 0));
  camera.attachControl(canvas, true);
  camera.speed = 0.35;
  camera.angularSensibility = 4_500;

  const hemiLight = new HemisphericLight("hemi-light", new Vector3(0, 1, 0), scene);
  hemiLight.intensity = 0.62;

  const directionalLight = new DirectionalLight("directional-light", new Vector3(-0.6, -1, 0.5), scene);
  directionalLight.intensity = 0.35;

  const floorMaterial = new StandardMaterial("floor-material", scene);
  floorMaterial.diffuseColor = new Color3(0.34, 0.35, 0.34);
  floorMaterial.specularColor = new Color3(0.05, 0.05, 0.05);

  const wallMaterial = new StandardMaterial("wall-material", scene);
  wallMaterial.diffuseColor = new Color3(0.22, 0.24, 0.25);
  wallMaterial.specularColor = new Color3(0.03, 0.03, 0.03);

  const propMaterial = new StandardMaterial("prop-material", scene);
  propMaterial.diffuseColor = new Color3(0.44, 0.49, 0.48);

  const floor = MeshBuilder.CreateGround("floor", { width: 18, height: 18 }, scene);
  floor.material = floorMaterial;

  const backWall = MeshBuilder.CreateBox("back-wall", { width: 18, height: 4, depth: 0.4 }, scene);
  backWall.position = new Vector3(0, 2, 9);
  backWall.material = wallMaterial;

  const frontWall = MeshBuilder.CreateBox("front-wall", { width: 18, height: 4, depth: 0.4 }, scene);
  frontWall.position = new Vector3(0, 2, -9);
  frontWall.material = wallMaterial;

  const leftWall = MeshBuilder.CreateBox("left-wall", { width: 0.4, height: 4, depth: 18 }, scene);
  leftWall.position = new Vector3(-9, 2, 0);
  leftWall.material = wallMaterial;

  const rightWall = MeshBuilder.CreateBox("right-wall", { width: 0.4, height: 4, depth: 18 }, scene);
  rightWall.position = new Vector3(9, 2, 0);
  rightWall.material = wallMaterial;

  const boxPositions = [
    new Vector3(-4.5, 0.5, -1.5),
    new Vector3(2.25, 0.75, 1.5),
    new Vector3(5.5, 0.5, -4.25),
    new Vector3(-1, 1, 4.5),
  ];

  boxPositions.forEach((position, index) => {
    const box = MeshBuilder.CreateBox(`greybox-prop-${index + 1}`, { size: index === 1 ? 1.5 : 1 }, scene);
    box.position = position;
    box.material = propMaterial;
  });

  return scene;
}
