import type { InputFrame } from "../game/player/PlayerController";

export type InputAction =
  "moveForward" | "moveBackward" | "moveLeft" | "moveRight" | "sprint" | "jump" | "dash";

interface MouseDelta {
  readonly x: number;
  readonly y: number;
}

interface InputManagerOptions {
  readonly canvas: HTMLCanvasElement;
  readonly onPauseRequested: () => void;
  readonly onPerfToggleRequested: () => void;
  readonly onPointerLockLost: () => void;
}

const actionBindings = {
  moveForward: ["KeyW"],
  moveBackward: ["KeyS"],
  moveLeft: ["KeyA"],
  moveRight: ["KeyD"],
  sprint: ["ShiftLeft"],
  jump: ["Space"],
  dash: ["KeyE"],
} as const satisfies Readonly<Record<InputAction, readonly string[]>>;

const keyToAction = new Map<string, InputAction>(
  Object.entries(actionBindings).flatMap(([action, keys]) => keys.map((key) => [key, action as InputAction])),
);

const emptyInputFrame: InputFrame = Object.freeze({
  moveX: 0,
  moveY: 0,
  sprintHeld: false,
  jumpPressed: false,
  jumpHeld: false,
  dashPressed: false,
  dashHeld: false,
});

const heldActions = new Set<InputAction>();
const pressedActions = new Set<InputAction>();
const releasedActions = new Set<InputAction>();

export class InputManager {
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Escape") {
      this.options.onPauseRequested();
      return;
    }

    if (event.code === "F3") {
      event.preventDefault();
      this.options.onPerfToggleRequested();
      return;
    }

    const action = keyToAction.get(event.code);
    if (!action) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
    }

    if (!heldActions.has(action) && !event.repeat) {
      pressedActions.add(action);
    }

    heldActions.add(action);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const action = keyToAction.get(event.code);
    if (!action) {
      return;
    }

    heldActions.delete(action);
    releasedActions.add(action);
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.options.canvas) {
      return;
    }

    this.mouseDeltaX += event.movementX;
    this.mouseDeltaY += event.movementY;
  };

  private readonly handlePointerLockChange = (): void => {
    if (document.pointerLockElement === this.options.canvas) {
      return;
    }

    this.reset();
    this.options.onPointerLockLost();
  };

  private readonly handleBlur = (): void => {
    this.reset();
  };

  constructor(private readonly options: InputManagerOptions) {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
  }

  consumeInputFrame(): InputFrame {
    if (heldActions.size === 0 && pressedActions.size === 0) {
      releasedActions.clear();
      return emptyInputFrame;
    }

    const frame: InputFrame = Object.freeze({
      moveX: this.axis("moveRight", "moveLeft"),
      moveY: this.axis("moveForward", "moveBackward"),
      sprintHeld: heldActions.has("sprint"),
      jumpPressed: pressedActions.has("jump"),
      jumpHeld: heldActions.has("jump"),
      dashPressed: pressedActions.has("dash"),
      dashHeld: heldActions.has("dash"),
    });

    pressedActions.clear();
    releasedActions.clear();
    return frame;
  }

  consumeMouseDelta(): MouseDelta {
    const delta = {
      x: this.mouseDeltaX,
      y: this.mouseDeltaY,
    };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }

  reset(): void {
    heldActions.clear();
    pressedActions.clear();
    releasedActions.clear();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
  }

  private axis(positive: InputAction, negative: InputAction): number {
    return Number(heldActions.has(positive)) - Number(heldActions.has(negative));
  }
}
