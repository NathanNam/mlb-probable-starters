"use client";

import { useState } from "react";
import DateStrip from "./DateStrip";
import Banner from "./Banner";
import MatchupCard from "./MatchupCard";
import TeamSelect from "./TeamSelect";
import { useAsync } from "@/lib/useAsync";
import { assembleSlate, filterSlate, probableIds, type PitcherLine, type SlateSide } from "@/lib/slate";
import { fetchPitcherLines, fetchScheduleForDate } from "@/lib/statsapi";
import { loadBanner } from "@/lib/offseason";
import { formatYmd, seasonFromDate } from "@/lib/dates";
import type { Team } from "@/lib/teams";

interface SlateViewProps {
  date: string;
  today: string;
  timeZone: string;
  team?: Team;
  onDate: (date: string) => void;
  onTeam: (teamId: number | null) => void;
  watched: Set<number>;
  onToggleWatch: (pitcher: PitcherLine, side: SlateSide) => void;
  sidebar: React.ReactNode;
}

async function loadSlate(date: string) {
  const schedule = await fetchScheduleForDate(date);
  const ids = probableIds(schedule);
  // Stats are a bonus: if that request fails, still show the matchups.
  const people = await fetchPitcherLines(ids, date, seasonFromDate(date)).catch(() => null);
  return { games: assembleSlate(schedule, people), statsMissing: ids.length > 0 && people === null };
}

export default function SlateView(props: SlateViewProps) {
  const { date, today, timeZone, team, onDate, onTeam, watched, onToggleWatch, sidebar } = props;
  const [query, setQuery] = useState("");
  const slate = useAsync(`slate:${date}`, () => loadSlate(date));
  const empty = slate.data && slate.data.games.length === 0;
  const banner = useAsync(empty ? `banner:${date}:${today}` : null, () => loadBanner(date, date === today));
  const nextDate =
    banner.data?.action && (banner.data.tag === "Postseason" || banner.data.tag === "Off day") ? banner.data.action.date : null;
  const next = useAsync(nextDate ? `slate:${nextDate}` : null, () => loadSlate(nextDate!));
  const shown = slate.data ? filterSlate(slate.data.games, team?.id, query) : [];
  const total = slate.data?.games.length ?? 0;

  return (
    <>
      <div className="bar">
        <DateStrip selected={date} today={today} onSelect={onDate} />
        <div className="search">
          <TeamSelect id="slate-team" label="Show one club" value={team?.id ?? null} onChange={onTeam} emptyLabel="All 30 clubs" />
          <label className="field" htmlFor="slate-find">
            <span className="sr-only">Find a starting pitcher on this date</span>
            <input
              id="slate-find"
              type="search"
              value={query}
              placeholder="Find a pitcher…"
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      </div>

      {banner.data && <Banner info={banner.data} onGo={onDate} />}

      <div className="cols">
        <main>
          <div className="sechead">
            <h2>{formatYmd(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h2>
            <span>
              {slate.data ? `${total === 0 ? "No" : total} game${total === 1 ? "" : "s"} · ` : ""}times in {timeZone.replace(/_/g, " ")}
            </span>
          </div>

          {slate.loading && (
            <div className="slate" aria-busy="true">
              {[0, 1].map((i) => (
                <div key={i} className="card ghost" aria-hidden="true">
                  <div className="inner" />
                </div>
              ))}
              <p className="sr-only" role="status">Loading the slate…</p>
            </div>
          )}

          {slate.error != null && (
            <div className="sheet notice" role="alert">
              <div className="inner">
                <h3>Rain delay</h3>
                <p>We couldn&apos;t reach MLB&apos;s stats service, so this isn&apos;t the real slate. Check your connection and try again.</p>
                <button type="button" className="btn" onClick={slate.retry}>
                  Try again
                </button>
              </div>
            </div>
          )}

          {slate.data?.statsMissing && (
            <p className="note" role="status">Season stats didn&apos;t load; matchups are shown without them.</p>
          )}

          {empty && !banner.data && (
            <div className="sheet notice">
              <div className="inner">
                <h3>No games</h3>
                <p>
                  Nothing on MLB&apos;s schedule for {formatYmd(date, { weekday: "long", month: "long", day: "numeric" })}.
                  {banner.loading && " Looking for the next game…"}
                  {banner.error != null && " (We couldn't check when the next game is.)"}
                </p>
              </div>
            </div>
          )}

          {slate.data && total > 0 && shown.length === 0 && (
            <div className="sheet notice">
              <div className="inner">
                <h3>No match</h3>
                <p>
                  {query ? `No starter named “${query}”` : "No game"}
                  {team ? ` for the ${team.name}` : ""} on this date.
                </p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setQuery("");
                    onTeam(null);
                  }}
                >
                  Show all games
                </button>
              </div>
            </div>
          )}

          {shown.length > 0 && (
            <div className="slate">
              {shown.map((g) => (
                <MatchupCard key={g.gamePk} game={g} timeZone={timeZone} watched={watched} onToggleWatch={onToggleWatch} />
              ))}
            </div>
          )}

          {nextDate && next.data && next.data.games.length > 0 && (
            <section className="nextup" aria-label="Next games">
              <div className="sechead">
                <h2>Next up · {formatYmd(nextDate, { weekday: "short", month: "short", day: "numeric" })}</h2>
                <span>
                  {next.data.games.length} game{next.data.games.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="slate">
                {next.data.games.slice(0, 4).map((g) => (
                  <MatchupCard key={g.gamePk} game={g} timeZone={timeZone} watched={watched} onToggleWatch={onToggleWatch} />
                ))}
              </div>
              {next.data.games.length > 4 && (
                <button type="button" className="btn nextall" onClick={() => onDate(nextDate)}>
                  All {next.data.games.length} games →
                </button>
              )}
            </section>
          )}
        </main>
        <aside className="side">{sidebar}</aside>
      </div>
    </>
  );
}
