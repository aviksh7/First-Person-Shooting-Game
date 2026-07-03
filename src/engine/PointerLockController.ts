export class PointerLockController {
  constructor(private readonly canvas: HTMLCanvasElement) {}

  get isLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  async request(): Promise<boolean> {
    if (!this.canvas.requestPointerLock) {
      return false;
    }

    try {
      await this.canvas.requestPointerLock();
      return this.isLocked;
    } catch {
      return false;
    }
  }

  release(): void {
    if (this.isLocked) {
      document.exitPointerLock();
    }
  }
}
