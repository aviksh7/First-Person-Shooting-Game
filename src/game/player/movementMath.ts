export interface HorizontalVelocity {
  readonly x: number;
  readonly z: number;
}

export interface WishDirection {
  readonly x: number;
  readonly z: number;
}

export interface DashTimers {
  readonly durationRemaining: number;
  readonly cooldownRemaining: number;
}

const clampToZero = (value: number): number => Math.max(0, value);

export function horizontalLength(velocity: HorizontalVelocity): number {
  return Math.hypot(velocity.x, velocity.z);
}

export function normalizeHorizontal(direction: WishDirection): WishDirection {
  const length = Math.hypot(direction.x, direction.z);
  if (length <= Number.EPSILON) {
    return { x: 0, z: 0 };
  }

  return {
    x: direction.x / length,
    z: direction.z / length,
  };
}

export function accelerateHorizontal(
  velocity: HorizontalVelocity,
  wishDirection: WishDirection,
  targetSpeed: number,
  acceleration: number,
  dtSeconds: number,
): HorizontalVelocity {
  const normalizedWish = normalizeHorizontal(wishDirection);
  if (targetSpeed <= 0 || acceleration <= 0 || horizontalLength(normalizedWish) === 0) {
    return velocity;
  }

  const currentSpeedAlongWish = velocity.x * normalizedWish.x + velocity.z * normalizedWish.z;
  const speedToAdd = targetSpeed - currentSpeedAlongWish;
  if (speedToAdd <= 0) {
    return velocity;
  }

  const addedSpeed = Math.min(acceleration * dtSeconds, speedToAdd);
  return {
    x: velocity.x + normalizedWish.x * addedSpeed,
    z: velocity.z + normalizedWish.z * addedSpeed,
  };
}

export function applyGroundFriction(
  velocity: HorizontalVelocity,
  friction: number,
  dtSeconds: number,
): HorizontalVelocity {
  const speed = horizontalLength(velocity);
  if (speed <= Number.EPSILON || friction <= 0) {
    return { x: 0, z: 0 };
  }

  const newSpeed = Math.max(0, speed - friction * dtSeconds);
  if (newSpeed === 0) {
    return { x: 0, z: 0 };
  }

  const scale = newSpeed / speed;
  return {
    x: velocity.x * scale,
    z: velocity.z * scale,
  };
}

export function integrateGravity(verticalVelocity: number, gravity: number, dtSeconds: number): number {
  return verticalVelocity - gravity * dtSeconds;
}

export function jumpVelocityFromApex(jumpApexHeight: number, gravity: number): number {
  return Math.sqrt(2 * gravity * jumpApexHeight);
}

export function updateCoyoteTimer(
  currentSeconds: number,
  grounded: boolean,
  dtSeconds: number,
  maxSeconds: number,
): number {
  return grounded ? maxSeconds : clampToZero(currentSeconds - dtSeconds);
}

export function updateJumpBufferTimer(
  currentSeconds: number,
  jumpPressed: boolean,
  dtSeconds: number,
  maxSeconds: number,
): number {
  return jumpPressed ? maxSeconds : clampToZero(currentSeconds - dtSeconds);
}

export function updateDashTimers(timers: DashTimers, dtSeconds: number): DashTimers {
  return {
    durationRemaining: clampToZero(timers.durationRemaining - dtSeconds),
    cooldownRemaining: clampToZero(timers.cooldownRemaining - dtSeconds),
  };
}

export function isSlopeWalkable(slopeDegrees: number, maxSlopeDegrees: number): boolean {
  return slopeDegrees <= maxSlopeDegrees;
}
