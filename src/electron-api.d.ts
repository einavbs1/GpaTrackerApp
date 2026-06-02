import type { AppState } from "./types";

declare global {
  interface Window {
    appApi?: {
      loadState: () => Promise<unknown>;
      saveState: (state: AppState) => Promise<boolean>;
    };
  }
}

export {};
