export interface UiCommands {
  readonly requestPlay: () => Promise<void>;
  readonly requestResume: () => Promise<void>;
  readonly requestPause: () => void;
  readonly togglePerfOverlay: () => void;
}
