import { EventBus } from "../EventBus";
import { defaultMovementConfig, type MovementConfig } from "./movementConfig";
import {
  accelerateHorizontal,
  applyGroundFriction,
  horizontalLength,
  integrateGravity,
  isSlopeWalkable,
  jumpVelocityFromApex,
  normalizeHorizontal,
  updateCoyoteTimer,
  updateDashTimers,
  updateJumpBufferTimer,
  type HorizontalVelocity,
} from "./movementMath";

export type PlayerMovementState = "Grounded" | "Airborne" | "Dashing";

export interface InputFrame {
  readonly moveX: number;
  readonly moveY: number;
  readonly sprintHeld: boolean;
  readonly jumpPressed: boolean;
  readonly jumpHeld: boolean;
  readonly dashPressed: boolean;
  readonly dashHeld: boolean;
}

export interface PlayerPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface GroundReport {
  readonly grounded: boolean;
  readonly slopeDegrees: number;
  readonly groundNormal: PlayerPosition;
}

export interface PlayerStep {
  readonly displacement: PlayerPosition;
}

export interface PlayerDebugSnapshot {
  readonly state: PlayerMovementState;
  readonly horizontalSpeed: number;
  readonly grounded: boolean;
  readonly dashCooldownRemaining: number;
  readonly position: PlayerPosition;
}

export interface PlayerEvents {
  readonly "player/jumped": PlayerDebugSnapshot;
  readonly "player/landed": PlayerDebugSnapshot;
  readonly "player/dashStarted": PlayerDebugSnapshot;
  readonly "player/dashReady": PlayerDebugSnapshot;
  readonly "player/stateChanged": PlayerMovementState;
}

const zeroPosition: PlayerPosition = { x: 0, y: 0, z: 0 };

export class PlayerController {
  private readonly config: MovementConfig;
  private readonly events: EventBus<PlayerEvents>;
  private position: PlayerPosition;
  private horizontalVelocity: HorizontalVelocity = { x: 0, z: 0 };
  private verticalVelocity = 0;
  private state: PlayerMovementState = "Grounded";
  private coyoteTimerSeconds = 0;
  private jumpBufferSeconds = 0;
  private dashDurationRemainingSeconds = 0;
  private dashCooldownRemainingSeconds = 0;
  private hasDashedSinceAirborne = false;
  private wasDashReady = true;
  private grounded = true;

  constructor(options?: {
    readonly config?: MovementConfig;
    readonly events?: EventBus<PlayerEvents>;
    readonly initialPosition?: PlayerPosition;
  }) {
    this.config = options?.config ?? defaultMovementConfig;
    this.events = options?.events ?? new EventBus<PlayerEvents>();
    this.position = options?.initialPosition ?? zeroPosition;
  }

  get eventBus(): EventBus<PlayerEvents> {
    return this.events;
  }

  update(
    dtSeconds: number,
    inputFrame: InputFrame,
    yawRadians: number,
    groundReport: GroundReport,
  ): PlayerStep {
    const walkableGround = this.hasWalkableGroundContact(groundReport);
    this.grounded = walkableGround;
    this.coyoteTimerSeconds = updateCoyoteTimer(
      this.coyoteTimerSeconds,
      walkableGround,
      dtSeconds,
      this.config.coyoteTime,
    );
    this.jumpBufferSeconds = updateJumpBufferTimer(
      this.jumpBufferSeconds,
      inputFrame.jumpPressed,
      dtSeconds,
      this.config.jumpBufferTime,
    );

    this.updateDashState(dtSeconds);

    const wishDirection = this.createWishDirection(inputFrame, yawRadians);
    const targetSpeed = inputFrame.sprintHeld ? this.config.sprintSpeed : this.config.walkSpeed;

    if (this.dashDurationRemainingSeconds > 0) {
      this.setState("Dashing");
    } else {
      this.applyRegularMovement(dtSeconds, wishDirection, targetSpeed, walkableGround);
    }

    if (inputFrame.dashPressed) {
      this.tryStartDash(wishDirection, yawRadians);
    }

    if (this.jumpBufferSeconds > 0 && this.coyoteTimerSeconds > 0) {
      this.jumpBufferSeconds = 0;
      this.coyoteTimerSeconds = 0;
      this.verticalVelocity = jumpVelocityFromApex(this.config.jumpApexHeight, this.config.gravity);
      this.grounded = false;
      this.setState("Airborne");
      this.events.emit("player/jumped", this.getDebugSnapshot());
    }

    if (!this.grounded && this.state !== "Dashing") {
      this.verticalVelocity = integrateGravity(this.verticalVelocity, this.config.gravity, dtSeconds);
    }

    if (this.grounded && this.verticalVelocity < 0) {
      this.verticalVelocity = 0;
    }

    return {
      displacement: {
        x: this.horizontalVelocity.x * dtSeconds,
        y: this.verticalVelocity * dtSeconds,
        z: this.horizontalVelocity.z * dtSeconds,
      },
    };
  }

  reconcilePosition(position: PlayerPosition, groundReport: GroundReport): void {
    const wasGrounded = this.grounded;
    this.position = position;
    this.grounded = this.hasWalkableGroundContact(groundReport);

    if (this.grounded) {
      this.hasDashedSinceAirborne = false;
      if (this.verticalVelocity < 0) {
        this.verticalVelocity = 0;
      }
      if (this.dashDurationRemainingSeconds === 0) {
        this.setState("Grounded");
      }
    } else if (this.state !== "Dashing") {
      this.setState("Airborne");
    }

    if (!wasGrounded && this.grounded) {
      this.events.emit("player/landed", this.getDebugSnapshot());
    }
  }

  getDebugSnapshot(): PlayerDebugSnapshot {
    return {
      state: this.state,
      horizontalSpeed: horizontalLength(this.horizontalVelocity),
      grounded: this.grounded,
      dashCooldownRemaining: this.dashCooldownRemainingSeconds,
      position: this.position,
    };
  }

  private applyRegularMovement(
    dtSeconds: number,
    wishDirection: HorizontalVelocity,
    targetSpeed: number,
    walkableGround: boolean,
  ): void {
    if (walkableGround) {
      this.setState("Grounded");
      if (horizontalLength(wishDirection) === 0) {
        this.horizontalVelocity = applyGroundFriction(
          this.horizontalVelocity,
          this.config.groundFriction,
          dtSeconds,
        );
      } else {
        this.horizontalVelocity = accelerateHorizontal(
          this.horizontalVelocity,
          wishDirection,
          targetSpeed,
          this.config.groundAcceleration,
          dtSeconds,
        );
      }
      return;
    }

    this.setState("Airborne");
    this.horizontalVelocity = accelerateHorizontal(
      this.horizontalVelocity,
      wishDirection,
      targetSpeed,
      this.config.groundAcceleration * this.config.airControl,
      dtSeconds,
    );
  }

  private tryStartDash(wishDirection: HorizontalVelocity, yawRadians: number): void {
    if (this.dashCooldownRemainingSeconds > 0 || this.hasDashedSinceAirborne) {
      return;
    }

    const fallbackForward = {
      x: Math.sin(yawRadians),
      z: Math.cos(yawRadians),
    };
    const dashDirection =
      horizontalLength(wishDirection) > 0 ? normalizeHorizontal(wishDirection) : fallbackForward;

    this.horizontalVelocity = {
      x: dashDirection.x * this.config.dashSpeed,
      z: dashDirection.z * this.config.dashSpeed,
    };
    this.verticalVelocity = 0;
    this.dashDurationRemainingSeconds = this.config.dashDuration;
    this.dashCooldownRemainingSeconds = this.config.dashCooldown;
    this.hasDashedSinceAirborne = true;
    this.wasDashReady = false;
    this.setState("Dashing");
    this.events.emit("player/dashStarted", this.getDebugSnapshot());
  }

  private updateDashState(dtSeconds: number): void {
    const previousCooldown = this.dashCooldownRemainingSeconds;
    const timers = updateDashTimers(
      {
        durationRemaining: this.dashDurationRemainingSeconds,
        cooldownRemaining: this.dashCooldownRemainingSeconds,
      },
      dtSeconds,
    );

    this.dashDurationRemainingSeconds = timers.durationRemaining;
    this.dashCooldownRemainingSeconds = timers.cooldownRemaining;

    if (previousCooldown > 0 && this.dashCooldownRemainingSeconds === 0 && !this.wasDashReady) {
      this.wasDashReady = true;
      this.events.emit("player/dashReady", this.getDebugSnapshot());
    }
  }

  private createWishDirection(inputFrame: InputFrame, yawRadians: number): HorizontalVelocity {
    if (inputFrame.moveX === 0 && inputFrame.moveY === 0) {
      return { x: 0, z: 0 };
    }

    const forwardX = Math.sin(yawRadians);
    const forwardZ = Math.cos(yawRadians);
    const rightX = Math.cos(yawRadians);
    const rightZ = -Math.sin(yawRadians);

    return normalizeHorizontal({
      x: rightX * inputFrame.moveX + forwardX * inputFrame.moveY,
      z: rightZ * inputFrame.moveX + forwardZ * inputFrame.moveY,
    });
  }

  private setState(nextState: PlayerMovementState): void {
    if (this.state === nextState) {
      return;
    }

    this.state = nextState;
    this.events.emit("player/stateChanged", nextState);
  }

  private hasWalkableGroundContact(groundReport: GroundReport): boolean {
    return (
      groundReport.grounded &&
      this.verticalVelocity <= 0.01 &&
      isSlopeWalkable(groundReport.slopeDegrees, this.config.maxSlopeDegrees)
    );
  }
}
