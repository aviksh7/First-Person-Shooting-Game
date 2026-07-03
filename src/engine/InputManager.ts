interface InputManagerOptions {
  readonly onPauseRequested: () => void;
  readonly onPerfToggleRequested: () => void;
}

export class InputManager {
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Escape") {
      this.options.onPauseRequested();
    }

    if (event.code === "F3") {
      event.preventDefault();
      this.options.onPerfToggleRequested();
    }
  };

  constructor(private readonly options: InputManagerOptions) {
    window.addEventListener("keydown", this.handleKeyDown);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
