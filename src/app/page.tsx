"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import Masthead from "@/components/Masthead";
import SlateView from "@/components/SlateView";
import RotationView, { SetupPrompt } from "@/components/RotationView";
import RotationSheet from "@/components/RotationSheet";
import PitchersView from "@/components/PitchersView";
import { useView, type Tab } from "@/lib/urlState";
import { useSaved } from "@/lib/storage";
import { useAsync } from "@/lib/useAsync";
import { runRotationWatch } from "@/lib/rotation";
import { todayET, todayLocal, viewerTimeZone } from "@/lib/dates";
import { teamByAbbr, teamById } from "@/lib/teams";
import type { SelectedPitcher } from "@/lib/types";
import type { PitcherLine, SlateSide } from "@/lib/slate";

const noopSubscribe = () => () => {};

export default function Page() {
  // The static HTML carries the masthead; everything date- and viewer-specific renders in the browser.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return (
    <div className="wrap">
      {hydrated ? (
        <App />
      ) : (
        <>
          <Masthead tab="slate" onTab={() => {}} />
          <p className="booting">Shuffling the deck…</p>
        </>
      )}
      <footer>
        Data: MLB Stats API (statsapi.mlb.com), no key needed · season stats entering each game · times in your time zone ·
        projections are estimates · original drawings, no team or league marks · not affiliated with MLB
      </footer>
    </div>
  );
}

function App() {
  const [view, setView] = useView();
  const [saved, setSaved] = useSaved();
  const timeZone = viewerTimeZone();
  const today = todayLocal();
  const date = view.date ?? today;
  const urlTeam = teamByAbbr(view.team);
  const home = (view.tab !== "slate" ? urlTeam : undefined) ?? teamById(saved.teamId ?? undefined);
  const pitchers = saved.pitchers;

  const rotationKey = home && pitchers.length > 0 ? `${home.id}|${pitchers.map((p) => p.id).join(",")}|${todayET()}` : null;
  const rotation = useAsync(rotationKey, () => runRotationWatch(home!, pitchers, todayET()));

  // Remember a traded pitcher's new club.
  useEffect(() => {
    const updated = rotation.data?.pitchers;
    if (!updated) return;
    const changed = updated.some((p) => {
      const old = saved.pitchers.find((s) => s.id === p.id);
      return old && old.teamId !== p.teamId;
    });
    if (changed) {
      const byId = new Map(updated.map((p) => [p.id, p]));
      setSaved({ ...saved, pitchers: saved.pitchers.map((p) => byId.get(p.id) ?? p) });
    }
  }, [rotation.data, saved, setSaved]);

  const setTab = useCallback((tab: Tab) => setView({ tab, team: undefined }), [setView]);
  const addPitcher = (p: SelectedPitcher) => {
    if (!pitchers.some((x) => x.id === p.id)) setSaved({ ...saved, pitchers: [...pitchers, p] });
  };
  const removePitcher = (id: number) => setSaved({ ...saved, pitchers: pitchers.filter((p) => p.id !== id) });
  const toggleWatch = (p: PitcherLine, side: SlateSide) => {
    if (pitchers.some((x) => x.id === p.id)) removePitcher(p.id);
    else addPitcher({ id: p.id, fullName: p.fullName, pitchHand: p.hand || "R", teamId: side.team.id, teamName: side.team.name });
  };
  const setHome = (teamId: number | null) => {
    setSaved({ ...saved, teamId });
    if (view.team) setView({ team: undefined }, { replace: true });
  };

  const sheetProps = {
    pitchers,
    result: rotation.data,
    loading: rotation.loading,
    error: rotation.error,
    retry: rotation.retry,
    timeZone,
  };

  return (
    <>
      <Masthead tab={view.tab} onTab={setTab} />
      {view.tab === "slate" && (
        <SlateView
          date={date}
          today={today}
          timeZone={timeZone}
          team={urlTeam}
          onDate={(d) => setView({ date: d === today ? undefined : d })}
          onTeam={(id) => setView({ team: teamById(id ?? undefined)?.abbr }, { replace: true })}
          watched={new Set(pitchers.map((p) => p.id))}
          onToggleWatch={toggleWatch}
          sidebar={
            home && pitchers.length > 0 ? (
              <RotationSheet {...sheetProps} home={home} compact onMore={() => setTab("rotation")} />
            ) : (
              <SetupPrompt home={home} onSetup={() => setTab("pitchers")} />
            )
          }
        />
      )}
      {view.tab === "rotation" && <RotationView {...sheetProps} home={home} onSetup={() => setTab("pitchers")} />}
      {view.tab === "pitchers" && (
        <PitchersView
          home={home}
          pitchers={pitchers}
          result={rotation.data}
          onHome={setHome}
          onAdd={addPitcher}
          onRemove={removePitcher}
          onShowWatch={() => setTab("rotation")}
        />
      )}
    </>
  );
}
