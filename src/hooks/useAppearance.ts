import { useCallback, useEffect, useState } from "react";
import { applyAppearance, readStoredAppearance, resolveMode, storeAppearance } from "@/lib/theme";
import type { Appearance } from "@/types";

export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(readStoredAppearance);
  const [resolvedMode, setResolvedMode] = useState<"dark" | "light">(() => resolveMode(readStoredAppearance().mode));

  useEffect(() => {
    setResolvedMode(applyAppearance(appearance));
    storeAppearance(appearance);
  }, [appearance]);

  useEffect(() => {
    if (appearance.mode !== "system" || typeof window.matchMedia !== "function") return;

    const list = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setResolvedMode(applyAppearance(appearance));
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [appearance]);

  const patchAppearance = useCallback((patch: Partial<Appearance>) => {
    setAppearance((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleMode = useCallback(() => {
    setAppearance((prev) => ({ ...prev, mode: resolveMode(prev.mode) === "dark" ? "light" : "dark" }));
  }, []);

  return { appearance, setAppearance, patchAppearance, resolvedMode, toggleMode };
}
