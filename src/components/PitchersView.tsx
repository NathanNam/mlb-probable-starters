import type { CSSProperties } from "react";
import PitcherSearch from "./PitcherSearch";
import TeamSelect from "./TeamSelect";
import type { RotationResult } from "@/lib/rotation";
import { formatYmd } from "@/lib/dates";
import { pitcherColor, teamById, type Team } from "@/lib/teams";
import type { SelectedPitcher } from "@/lib/types";
import { CONFIDENCE_LABEL } from "./Pips";

interface PitchersViewProps {
  home?: Team;
  pitchers: SelectedPitcher[];
  result?: RotationResult;
  onHome: (teamId: number | null) => void;
  onAdd: (p: SelectedPitcher) => void;
  onRemove: (id: number) => void;
  onShowWatch: () => void;
}

export default function PitchersView({ home, pitchers, result, onHome, onAdd, onRemove, onShowWatch }: PitchersViewProps) {
  const rot = new Map(result?.rotations.map((r) => [r.pitcherId, r]) ?? []);
  return (
    <div className="setup">
      <section className="sheet">
        <div className="inner pad">
          <h2 className="step">
            <span>1</span> Your home ballpark
          </h2>
          <p className="hint">We&apos;ll look for games at this club&apos;s park.</p>
          <TeamSelect id="home-team" label="Home team" value={home?.id ?? null} onChange={onHome} emptyLabel="Choose a club…" />
        </div>
      </section>

      <section className="sheet">
        <div className="inner pad">
          <h2 className="step">
            <span>2</span> Opposing starters to watch
          </h2>
          <p className="hint">Search by name, or tap ☆ next to any starter on the daily slate.</p>
          <PitcherSearch selected={pitchers} onAdd={onAdd} />
          {pitchers.length > 0 ? (
            <ul className="roster">
              {pitchers.map((p, i) => {
                const team = teamById(p.teamId);
                const r = rot.get(p.id);
                const w = result?.warnings.get(p.id);
                return (
                  <li key={p.id} style={{ "--c1": team?.colors[0] ?? "#555" } as CSSProperties}>
                    <span className="swatch" style={{ background: pitcherColor(i) }} aria-hidden="true" />
                    <span className="rabbr" aria-hidden="true">
                      {team?.abbr}
                    </span>
                    <div className="rname">
                      <b>{p.fullName}</b>
                      <i>
                        {p.pitchHand}HP · {p.teamName}
                        {r && ` · every ${r.avgGap} days`}
                        {r?.nextProjectedStart &&
                          ` · next ${formatYmd(r.nextProjectedStart, { month: "short", day: "numeric" })}${
                            r.nextProjectedConfidence ? ` (${CONFIDENCE_LABEL[r.nextProjectedConfidence].toLowerCase()})` : ""
                          }`}
                      </i>
                      {w && <i className="warn">⚠ {w.message}</i>}
                    </div>
                    <button type="button" className="x" aria-label={`Stop watching ${p.fullName}`} onClick={() => onRemove(p.id)}>
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-roster">No pitchers yet.</p>
          )}
        </div>
      </section>

      {home && pitchers.length > 0 && (
        <button type="button" className="btn big" onClick={onShowWatch}>
          See {home.abbr} home games vs your arms →
        </button>
      )}
    </div>
  );
}
