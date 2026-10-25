// Remembered home team and tracked pitchers (localStorage, guarded: private
// windows and blocked storage fall back to memory for the session).

import { useCallback, useSyncExternalStore } from "react";
import type { SelectedPitcher } from "./types";

const KEY = "mlb-pitcher-tracker";
const EVENT = "mlb-saved-change";

export interface Saved {
  teamId: number | null;
  pitchers: SelectedPitcher[];
}

let memory: string | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

let cacheRaw: string | null | undefined;
let cacheValue: Saved = { teamId: null, pitchers: [] };
const EMPTY: Saved = { teamId: null, pitchers: [] };

export function parseSaved(raw: string | null): Saved {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw);
    const teamId = typeof data.teamId === "number" ? data.teamId : typeof data.team?.id === "number" ? data.team.id : null;
    const pitchers = Array.isArray(data.pitchers)
      ? data.pitchers.filter((p: SelectedPitcher) => typeof p?.id === "number" && typeof p?.teamId === "number")
      : [];
    return { teamId, pitchers };
  } catch {
    return EMPTY;
  }
}

function snapshot(): Saved {
  const raw = readRaw();
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cacheValue = parseSaved(raw);
  }
  return cacheValue;
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function useSaved(): [Saved, (next: Saved) => void] {
  const value = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const set = useCallback((next: Saved) => {
    const raw = JSON.stringify(next);
    memory = raw;
    try {
      localStorage.setItem(KEY, raw);
    } catch {
      /* unavailable: keep it in memory */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [value, set];
}
