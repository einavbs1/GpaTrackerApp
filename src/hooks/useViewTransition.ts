import { useCallback } from "react";
import { flushSync } from "react-dom";

type StartViewTransition = (callback: () => void) => { finished: Promise<void> };

/**
 * Wraps a state change in the native View Transitions API. flushSync forces React
 * to commit inside the transition callback, otherwise the snapshot is taken too early.
 */
export function useViewTransition() {
  return useCallback((update: () => void) => {
    const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
    const prefersReducedMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (typeof start !== "function" || prefersReducedMotion) {
      update();
      return;
    }

    start.call(document, () => {
      flushSync(update);
    });
  }, []);
}
