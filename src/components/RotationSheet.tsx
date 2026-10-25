import Pips, { CONFIDENCE_LABEL, Diamond } from "./Pips";
import { formatGameTime, formatYmd } from "@/lib/dates";
import type { RotationResult } from "@/lib/rotation";
import { pitcherColor, teamById, type Team } from "@/lib/teams";
import type { MatchedGame, SelectedPitcher } from "@/lib/types";

interface RotationSheetProps {
  home: Team;
  pitchers: SelectedPitcher[];
  result?: RotationResult;
  loading: boolean;
  error: unknown;
  retry: () => void;
  timeZone: string;
  /** Sidebar version: only the next few home games. */
  compact?: boolean;
  onMore?: () => void;
}

const lastName = (name: string) => name.split(" ").slice(-1)[0];
const md = (d: string) => formatYmd(d, { month: "short", day: "numeric" });

export function Legend() {
  return (
    <div className="legend">
      <span>
        <Pips confidence="confirmed" small /> Confirmed — announced by MLB
      </span>
      <span>
        <Pips confidence="projected" small /> Projected — rotation lands within a day
      </span>
      <span>
        <Pips confidence="possible" small /> Possible — series fits, rotation doesn&apos;t line up
      </span>
    </div>
  );
}

function Scorecard({ result, pitchers }: { result: RotationResult; pitchers: SelectedPitcher[] }) {
  const index = new Map(pitchers.map((p, i) => [p.id, i]));
  return (
    <div className="sc-wrap">
      <table className="sc">
        <caption className="sr-only">Last five starts and next start for each pitcher you watch</caption>
        <colgroup>
          <col className="c-p" />
          <col span={6} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Pitcher</th>
            <th scope="col" colSpan={5}>
              Last five starts
            </th>
            <th scope="col">Next</th>
          </tr>
        </thead>
        <tbody>
          {result.rotations.map((r) => {
            const recent = r.starts.slice(-5);
            const pad = 5 - recent.length;
            const warning = result.warnings.get(r.pitcherId);
            const abbr = teamById(r.teamId)?.abbr ?? r.teamName;
            return (
              <tr key={r.pitcherId}>
                <th scope="row" className="p">
                  <span className="dot" style={{ background: pitcherColor(index.get(r.pitcherId) ?? 0) }} aria-hidden="true" />
                  {lastName(r.pitcherName)}
                  <i>
                    {r.pitchHand}HP · {abbr} · every {r.avgGap}d
                    {warning && (
                      <>
                        {" · "}
                        <span className="warn">⚠ {warning.message}</span>
                      </>
                    )}
                  </i>
                </th>
                {Array.from({ length: pad }, (_, i) => (
                  <td key={`pad${i}`} className="cell empty" aria-label="No start" />
                ))}
                {recent.map((s) => (
                  <td key={s.date} className="cell">
                    <Diamond filled />
                    <em>{md(s.date)}</em>
                    <span className="sr-only">
                      {s.isHome ? "vs" : "at"} {s.opponent}
                    </span>
                  </td>
                ))}
                <td className="cell next">
                  <Diamond filled={false} />
                  {r.nextProjectedStart ? (
                    <em>
                      {md(r.nextProjectedStart)}
                      <span className="conf">{r.nextProjectedConfidence ? CONFIDENCE_LABEL[r.nextProjectedConfidence].slice(0, 4) + "." : ""}</span>
                      <span className="sr-only">
                        {r.nextProjectedOpponent ? ` ${r.nextProjectedIsHome ? "vs" : "at"} ${r.nextProjectedOpponent}` : ""}{" "}
                        {r.nextProjectedConfidence ? `(${CONFIDENCE_LABEL[r.nextProjectedConfidence]})` : ""}
                      </span>
                    </em>
                  ) : (
                    <em>{result.homeSeasonOver ? result.homeSeason : "—"}</em>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HomeGame({ g, home, color, timeZone }: { g: MatchedGame; home: Team; color: string; timeZone: string }) {
  const opp = teamById(g.opponentId);
  const { time, zone } = formatGameTime(g.gameDate, timeZone);
  return (
    <li>
      <div className="d">
        <small>{formatYmd(g.date, { month: "short" })}</small>
        {Number(g.date.slice(8))}
        <small>{formatYmd(g.date, { weekday: "short" })}</small>
      </div>
      <div className="m">
        <span className="dot" style={{ background: color }} aria-hidden="true" />
        {opp?.abbr ?? g.opponent} @ {home.abbr} — {lastName(g.pitcher.fullName)}
        <i>
          {home.abbr} starter: {g.homePitcher ? lastName(g.homePitcher.fullName) : "TBD"} · {g.startTimeTBD ? "time TBD" : `${time} ${zone}`}
          {g.doubleHeader && g.doubleHeader !== "N" ? ` · Gm ${g.gameNumber}` : ""} ·{" "}
          <a href={`https://www.mlb.com/gameday/${g.gamePk}`} target="_blank" rel="noopener noreferrer">
            Gameday<span className="sr-only"> (opens MLB.com)</span>
          </a>
        </i>
      </div>
      <Pips confidence={g.confidence} />
    </li>
  );
}

export default function RotationSheet(props: RotationSheetProps) {
  const { home, pitchers, result, loading, error, retry, timeZone, compact, onMore } = props;
  const color = new Map(pitchers.map((p, i) => [p.id, pitcherColor(i)]));
  const games = result?.matches ?? [];
  const shownGames = compact ? games.slice(0, 4) : games;
  const allDone = result && result.rotations.every((r) => !r.nextProjectedStart) && result.homeSeasonOver;

  return (
    <>
      <div className="sheet">
        <div className="inner">
          <h3>
            Rotation watch <span>Home: {home.abbr}</span>
          </h3>
          {loading && <p className="sheet-msg" role="status">Checking the rotations…</p>}
          {error != null && (
            <div className="sheet-msg" role="alert">
              Couldn&apos;t load rotations from MLB.{" "}
              <button type="button" className="linkish" onClick={retry}>
                Try again
              </button>
            </div>
          )}
          {result && <Scorecard result={result} pitchers={pitchers} />}
          {allDone && (
            <div className="past">
              Season over — last five starts shown; the {result.homeSeason} schedule is below.
            </div>
          )}
        </div>
      </div>

      <div className="sheet">
        <div className="inner">
          <h3>
            Home games vs your arms {result && <span>{result.homeSeason}</span>}
          </h3>
          {result && games.length === 0 && (
            <p className="sheet-msg">
              No {result.homeSeasonOver ? `${result.homeSeason} ` : "remaining "}
              {home.club} home games against{" "}
              {[...new Set(result.pitchers.map((p) => teamById(p.teamId)?.club ?? p.teamName))].join(", ")}. Games already
              played, postponed or suspended don&apos;t count.
            </p>
          )}
          {shownGames.length > 0 && (
            <ul className="homes">
              {shownGames.map((g) => (
                <HomeGame key={`${g.gamePk}-${g.pitcher.id}`} g={g} home={home} color={color.get(g.pitcher.id) ?? "#555"} timeZone={timeZone} />
              ))}
            </ul>
          )}
          {compact && games.length > shownGames.length && onMore && (
            <button type="button" className="more" onClick={onMore}>
              All {games.length} games in Rotation watch →
            </button>
          )}
          <Legend />
        </div>
      </div>
    </>
  );
}
