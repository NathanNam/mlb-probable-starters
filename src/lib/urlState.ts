// The view lives in the URL (?date=YYYY-MM-DD&tab=rotation&team=SF) so links work.

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { isValidYmd } from "./dates";

export type Tab = "slate" | "rotation" | "pitchers";
export const TABS: Tab[] = ["slate", "rotation", "pitchers"];

export interface ViewState {
  date?: string;
  tab: Tab;
  team?: string;
}

const EVENT = "mlb-url-change";

export function parseView(search: string): ViewState {
  const params = new URLSearchParams(search);
  const date = params.get("date");
  const tab = params.get("tab") as Tab | null;
  const team = params.get("team");
  return {
    date: isValidYmd(date) ? date : undefined,
    tab: tab && TABS.includes(tab) ? tab : "slate",
    team: team ? team.toUpperCase() : undefined,
  };
}

export function viewToSearch(view: ViewState): string {
  const params = new URLSearchParams();
  if (view.date) params.set("date", view.date);
  if (view.tab !== "slate") params.set("tab", view.tab);
  if (view.team) params.set("team", view.team);
  const s = params.toString();
  return s ? `?${s}` : "";
}

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function useView(): [ViewState, (patch: Partial<ViewState>, opts?: { replace?: boolean }) => void] {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const view = useMemo(() => parseView(search), [search]);
  const update = useCallback((patch: Partial<ViewState>, opts?: { replace?: boolean }) => {
    const next = { ...parseView(window.location.search), ...patch };
    const url = `${window.location.pathname}${viewToSearch(next)}${window.location.hash}`;
    if (opts?.replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [view, update];
}
