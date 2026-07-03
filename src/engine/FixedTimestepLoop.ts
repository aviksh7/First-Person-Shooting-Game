export type FixedUpdate = (deltaSeconds: number) => void;

export class FixedTimestepLoop {
  private readonly timestepSeconds = 1 / 60;
  private readonly maxFrameSeconds = 0.25;
  private readonly maxCatchUpSteps = 5;
  private accumulatorSeconds = 0;
  private lastTimeMs: number | undefined;

  step(nowMs: number, update: FixedUpdate): void {
    if (this.lastTimeMs === undefined) {
      this.lastTimeMs = nowMs;
      return;
    }

    const frameSeconds = Math.min((nowMs - this.lastTimeMs) / 1_000, this.maxFrameSeconds);
    this.lastTimeMs = nowMs;
    this.accumulatorSeconds += frameSeconds;

    let steps = 0;
    while (this.accumulatorSeconds >= this.timestepSeconds && steps < this.maxCatchUpSteps) {
      update(this.timestepSeconds);
      this.accumulatorSeconds -= this.timestepSeconds;
      steps += 1;
    }

    if (steps === this.maxCatchUpSteps && this.accumulatorSeconds >= this.timestepSeconds) {
      this.accumulatorSeconds = 0;
    }
  }

  reset(): void {
    this.accumulatorSeconds = 0;
    this.lastTimeMs = undefined;
  }
}
