import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { GroundReport, PlayerPosition } from "../game/player/PlayerController";
import type { MovementConfig } from "../game/player/movementConfig";

interface CollisionMoveResult {
  readonly position: PlayerPosition;
  readonly groundReport: GroundReport;
}

const groundNormal: PlayerPosition = { x: 0, y: 1, z: 0 };

export class PlayerCollisionBody {
  private readonly body: AbstractMesh;
  private readonly scratchDisplacement = new Vector3(0, 0, 0);
  private readonly roomLimit: number;

  constructor(
    scene: Scene,
    private readonly config: MovementConfig,
    initialFeetPosition: PlayerPosition,
  ) {
    this.roomLimit = 9 - config.playerRadius - 0.24;
    this.body = MeshBuilder.CreateBox(
      "player-collision-body",
      {
        width: config.playerRadius * 2,
        depth: config.playerRadius * 2,
        height: config.playerHeight,
      },
      scene,
    );
    this.body.isVisible = false;
    this.body.checkCollisions = true;
    this.body.ellipsoid = new Vector3(config.playerRadius, config.playerHeight / 2, config.playerRadius);
    this.setFeetPosition(initialFeetPosition);
  }

  move(displacement: PlayerPosition): CollisionMoveResult {
    this.scratchDisplacement.set(displacement.x, displacement.y, displacement.z);
    this.body.moveWithCollisions(this.scratchDisplacement);
    this.clampToGreyboxRoom();

    const feetPosition = this.getFeetPosition();
    if (feetPosition.y < 0) {
      this.setFeetPosition({ x: feetPosition.x, y: 0, z: feetPosition.z });
    }

    return {
      position: this.getFeetPosition(),
      groundReport: this.getGroundReport(),
    };
  }

  getFeetPosition(): PlayerPosition {
    return {
      x: this.body.position.x,
      y: this.body.position.y - this.config.playerHeight / 2,
      z: this.body.position.z,
    };
  }

  setFeetPosition(position: PlayerPosition): void {
    this.body.position.set(position.x, position.y + this.config.playerHeight / 2, position.z);
  }

  getGroundReport(): GroundReport {
    const feetY = this.body.position.y - this.config.playerHeight / 2;
    return {
      grounded: feetY <= this.config.groundSnapDistance,
      slopeDegrees: 0,
      groundNormal,
    };
  }

  dispose(): void {
    this.body.dispose();
  }

  private clampToGreyboxRoom(): void {
    this.body.position.x = Math.max(-this.roomLimit, Math.min(this.roomLimit, this.body.position.x));
    this.body.position.z = Math.max(-this.roomLimit, Math.min(this.roomLimit, this.body.position.z));
  }
}
