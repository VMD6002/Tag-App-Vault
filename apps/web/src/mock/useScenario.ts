import { useCallback } from "react";
import type { Scenario } from "./data";

export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "normal", label: "normal" },
  { id: "stress", label: "stress" },
  { id: "empty", label: "empty" },
  { id: "noresults", label: "no results" },
  { id: "loading", label: "loading" },
  { id: "error", label: "server error" },
];

const params = () => new URLSearchParams(location.hash.split("?")[1] ?? "");

/**
 * Scenario (`?s=`) and extension (`?x=0` turns it off) live in the hash (#/mock/library?s=stress).
 * Changing either reloads the page: the app keeps filters and tags in module-level atoms and the
 * fake server keeps its data in memory, so a clean load is the simple way to start over.
 */
export function useScenario() {
  const p = params();
  const scenario = (p.get("s") as Scenario | null) ?? "normal";
  const extension = p.get("x") !== "0";
  const update = useCallback((key: "s" | "x", value: string) => {
    const next = params();
    next.set(key, value);
    location.hash = `${location.hash.split("?")[0]}?${next}`;
  }, []);
  return {
    scenario,
    extension,
    setScenario: (id: string) => update("s", id),
    setExtension: (on: boolean) => update("x", on ? "1" : "0"),
  };
}
