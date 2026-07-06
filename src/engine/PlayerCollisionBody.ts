import "@babylonjs/core/Collisions/collisionCoordinator";
import type { Scene } from "@babylonjs/core/scene";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { CollisionContacts, GroundReport, PlayerPosition } from "../game/player/PlayerController";
import type { MovementConfig } from "../game/player/movementConfig";

interface CollisionMoveResult {
  readonly position: PlayerPosition;
  readonly groundReport: GroundReport;
  readonly contacts: CollisionContacts;
}

const groundNormal: PlayerPosition = { x: 0, y: 1, z: 0 };
const probeStartOffset = 0.05;

export class PlayerCollisionBody {
  private readonly body: AbstractMesh;
  private readonly scratchDisplacement = new Vector3(0, 0, 0);
  private readonly groundProbeOrigin = new Vector3(0, 0, 0);
  private readonly groundProbeDirection = new Vector3(0, -1, 0);
  private readonly groundProbeRay = new Ray(this.groundProbeOrigin, this.groundProbeDirection);

  constructor(
    private readonly scene: Scene,
    private readonly config: MovementConfig,
    initialFeetPosition: PlayerPosition,
  ) {
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
    const previousPosition = this.getFeetPosition();
    this.scratchDisplacement.set(displacement.x, displacement.y, displacement.z);
    this.body.moveWithCollisions(this.scratchDisplacement);

    if (displacement.y < 0) {
      this.snapToGroundIfClose();
    }

    const position = this.getFeetPosition();
    const actualDisplacement: PlayerPosition = {
      x: position.x - previousPosition.x,
      y: position.y - previousPosition.y,
      z: position.z - previousPosition.z,
    };

    return {
      position,
      groundReport: this.getGroundReport(),
      contacts: {
        upwardBlocked: displacement.y > 0 && actualDisplacement.y <= 0.0001,
      },
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
    const groundHit = this.probeGround(this.config.groundSnapDistance);
    if (!groundHit) {
      return {
        grounded: false,
        slopeDegrees: 0,
        groundNormal,
      };
    }

    return {
      grounded: true,
      slopeDegrees: groundHit.slopeDegrees,
      groundNormal: groundHit.groundNormal,
    };
  }

  dispose(): void {
    this.body.dispose();
  }

  private snapToGroundIfClose(): void {
    const groundHit = this.probeGround(this.config.groundSnapDistance);
    if (!groundHit) {
      return;
    }

    const feetPosition = this.getFeetPosition();
    this.setFeetPosition({
      x: feetPosition.x,
      y: groundHit.point.y,
      z: feetPosition.z,
    });
  }

  private probeGround(maxDistanceFromFeet: number):
    | {
        readonly point: Vector3;
        readonly distanceFromFeet: number;
        readonly slopeDegrees: number;
        readonly groundNormal: PlayerPosition;
      }
    | undefined {
    const feetPosition = this.getFeetPosition();
    this.groundProbeOrigin.set(feetPosition.x, feetPosition.y + probeStartOffset, feetPosition.z);
    this.groundProbeRay.length = maxDistanceFromFeet + probeStartOffset;

    const pick = this.scene.pickWithRay(
      this.groundProbeRay,
      (mesh) => mesh !== this.body && mesh.checkCollisions && mesh.isEnabled() && mesh.isVisible,
      false,
    );

    if (!pick?.hit || !pick.pickedPoint) {
      return undefined;
    }

    const normal = pick.getNormal(true, true) ?? Vector3.Up();
    normal.normalize();
    if (normal.y < 0) {
      normal.scaleInPlace(-1);
    }

    const distanceFromFeet = feetPosition.y - pick.pickedPoint.y;
    if (distanceFromFeet < -probeStartOffset || distanceFromFeet > maxDistanceFromFeet) {
      return undefined;
    }

    return {
      point: pick.pickedPoint,
      distanceFromFeet,
      slopeDegrees: (Math.acos(Math.max(-1, Math.min(1, normal.y))) * 180) / Math.PI,
      groundNormal: {
        x: normal.x,
        y: normal.y,
        z: normal.z,
      },
    };
  }
}
