import type { CSSProperties } from "react";
import { formatGameTime } from "@/lib/dates";
import type { PitcherLine, SlateGame, SlateSide } from "@/lib/slate";

interface MatchupCardProps {
  game: SlateGame;
  timeZone?: string;
  watched: Set<number>;
  onToggleWatch: (pitcher: PitcherLine, side: SlateSide) => void;
}

function Band({ side, home }: { side: SlateSide; home?: boolean }) {
  const [c1, c2] = side.team.colors;
  return (
    <div className={`t ${home ? "h" : "a"}`} style={{ "--c1": c1, "--c2": c2 } as CSSProperties}>
      <span className="abbr" aria-hidden="true">{side.team.abbr}</span>
      <span className="club">
        {side.team.club}
        {side.record && <i>{side.record}</i>}
      </span>
      <span className="sr-only">
        {side.team.name}
        {side.record ? `, ${side.record}` : ""}
        {home ? " (home)" : " (away)"}
      </span>
    </div>
  );
}

function Arm({
  side,
  season,
  postseason,
  watched,
  onToggleWatch,
}: {
  side: SlateSide;
  season: string;
  postseason: boolean;
  watched: boolean;
  onToggleWatch: () => void;
}) {
  const p = side.pitcher;
  if (!p) {
    return (
      <div className="arm">
        <div className="tbd">
          {side.team.abbr} starter <b>TBD</b>
        </div>
      </div>
    );
  }
  const era = parseFloat(p.stats?.era ?? "");
  return (
    <div className="arm">
      <div className="who">
        <div className="num" aria-label={p.number ? `Number ${p.number}` : "Number unknown"}>
          {p.number ?? "–"}
        </div>
        <div className="nm">
          <div className="last">{p.lastName}</div>
          <div className="first">
            {p.firstName}
            {p.hand && (
              <>
                {" · "}
                <b>{p.hand}HP</b>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          className="watch"
          aria-pressed={watched}
          aria-label={watched ? `Stop watching ${p.fullName}` : `Add ${p.fullName} to rotation watch`}
          title={watched ? "On your rotation watch" : "Add to rotation watch"}
          onClick={onToggleWatch}
        >
          {watched ? "★" : "☆"}
        </button>
      </div>
      {p.stats ? (
        <>
          <dl className="grid" aria-label={`${postseason ? "Regular-season" : `${season} season`} line entering this game`}>
            <div>
              <dt>W-L</dt>
              <dd>
                {p.stats.wins}-{p.stats.losses}
              </dd>
            </div>
            <div className={era < 3 ? "hot" : ""}>
              <dt>ERA</dt>
              <dd>{p.stats.era}</dd>
            </div>
            <div>
              <dt>WHIP</dt>
              <dd>{p.stats.whip}</dd>
            </div>
            <div>
              <dt>K</dt>
              <dd>{p.stats.strikeOuts}</dd>
            </div>
          </dl>
          <div className="line">
            {postseason && "Reg. season · "}
            {p.stats.gamesStarted} GS · {p.stats.inningsPitched} IP{p.stats.kPer9 ? ` · ${p.stats.kPer9} K/9` : ""}
          </div>
        </>
      ) : (
        <div className="line first-start">No MLB innings yet in {season} — first look.</div>
      )}
    </div>
  );
}

function Stamp({ game }: { game: SlateGame }) {
  const { kind, label } = game.status;
  const score =
    game.away.score !== undefined && game.home.score !== undefined ? ` ${game.away.score}–${game.home.score}` : "";
  if (kind === "final") return <span className="stamp">FINAL{score}</span>;
  if (kind === "live") return <span className="stamp live">{label.toUpperCase()}{score}</span>;
  if (kind === "postponed" || kind === "suspended" || kind === "cancelled" || kind === "delayed")
    return (
      <span className="stamp" title={game.status.reason}>
        {label.toUpperCase()}
      </span>
    );
  if (game.seriesNote) return <span className="stamp navy">{game.seriesNote.toUpperCase()}</span>;
  if (game.ifNecessary) return <span className="stamp navy">IF NEEDED</span>;
  return null;
}

export default function MatchupCard({ game, timeZone, watched, onToggleWatch }: MatchupCardProps) {
  const { time, zone } = formatGameTime(game.gameDate, timeZone);
  const season = game.officialDate.slice(0, 4);
  const where = [game.seriesLabel, game.venue, game.doubleHeader ? `Gm ${game.gameNumber}` : ""].filter(Boolean).join(" · ");
  return (
    <article className="card" aria-label={`${game.away.team.name} at ${game.home.team.name}`}>
      <div className="inner">
        <div className="band">
          <Band side={game.away} />
          <div className="mid" />
          <Band side={game.home} home />
        </div>
        <div className="die">
          <span className="pip p1" />
          <span className="pip p2" />
          {game.startTimeTBD ? (
            <b>
              TBD<small>{game.doubleHeader ? `GM ${game.gameNumber}` : "TIME"}</small>
            </b>
          ) : (
            <b>
              <time dateTime={game.gameDate}>{time}</time>
              <small>{zone}</small>
            </b>
          )}
        </div>
        <div className="arms">
          {(["away", "home"] as const).map((k) => {
            const side = game[k];
            return (
              <Arm
                key={k}
                side={side}
                season={season}
                postseason={game.isPostseason}
                watched={!!side.pitcher && watched.has(side.pitcher.id)}
                onToggleWatch={() => side.pitcher && onToggleWatch(side.pitcher, side)}
              />
            );
          })}
        </div>
        <div className="foot">
          <span className="where">{where}</span>
          <Stamp game={game} />
          <a href={`https://www.mlb.com/gameday/${game.gamePk}`} target="_blank" rel="noopener noreferrer">
            Gameday →<span className="sr-only"> (opens MLB.com)</span>
          </a>
        </div>
      </div>
    </article>
  );
}
