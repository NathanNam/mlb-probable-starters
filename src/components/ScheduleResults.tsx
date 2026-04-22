"use client";

import type { MatchedGame, SelectedPitcher, PitcherWarning, RotationInfo } from "@/lib/types";
import GameCard from "./GameCard";
import RotationPattern from "./RotationPattern";

const PITCHER_COLORS = [
  "#2563eb", "#dc2626", "#059669", "#7c3aed",
  "#d97706", "#0891b2", "#be185d", "#4f46e5",
];

const WARNING_ICONS: Record<PitcherWarning["type"], string> = {
  traded: "\u{1F504}",   // 🔄
  inactive: "\u{1FA79}", // 🩹
  no_starts: "\u{26A0}", // ⚠
};

interface ScheduleResultsProps {
  games: MatchedGame[];
  pitchers: SelectedPitcher[];
  teamName: string;
  teamAbbreviation: string;
  pitcherWarnings: Map<number, PitcherWarning>;
  rotationInfos: RotationInfo[];
}

export default function ScheduleResults({ games, pitchers, teamName, teamAbbreviation, pitcherWarnings, rotationInfos }: ScheduleResultsProps) {
  if (games.length === 0) {
    // Identify which teams don't visit this home stadium
    const uniqueTeams = Array.from(
      new Map(pitchers.map((p) => [p.teamId, p.teamName])).values()
    );

    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">&#9918;</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No matching home games found</h3>
        <div className="text-gray-500 max-w-md mx-auto">
          {uniqueTeams.length === 1 ? (
            <p>
              The <span className="font-medium text-gray-700">{uniqueTeams[0]}</span> don&apos;t
              visit the {teamName} this regular season. They may only play as an away series at the
              opponent&apos;s stadium.
            </p>
          ) : (
            <p>
              The following teams don&apos;t visit the {teamName} this regular season:{" "}
              {uniqueTeams.map((name, i) => (
                <span key={name}>
                  {i > 0 && (i === uniqueTeams.length - 1 ? " and " : ", ")}
                  <span className="font-medium text-gray-700">{name}</span>
                </span>
              ))}
              . They may only play as away series at the opponents&apos; stadiums.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Sort by date
  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));

  // Group by month
  const byMonth = new Map<string, MatchedGame[]>();
  for (const game of sorted) {
    const d = new Date(game.date + "T12:00:00Z");
    const monthKey = d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey)!.push(game);
  }

  // Build pitcher index map for consistent colors
  const pitcherIndexMap = new Map<number, number>();
  pitchers.forEach((p, i) => pitcherIndexMap.set(p.id, i));

  const confirmed = sorted.filter((g) => g.confidence === "confirmed").length;
  const projected = sorted.filter((g) => g.confidence === "projected").length;
  const possible = sorted.filter((g) => g.confidence === "possible").length;

  // Collect warnings for pitchers that appear in results
  const activeWarnings = Array.from(pitcherWarnings.entries())
    .filter(([id]) => pitchers.some((p) => p.id === id))
    .map(([id, warning]) => ({
      pitcher: pitchers.find((p) => p.id === id)!,
      warning,
      index: pitcherIndexMap.get(id) ?? 0,
    }));

  return (
    <div className="w-full max-w-2xl">
      {/* Pitcher warnings */}
      {activeWarnings.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {activeWarnings.map(({ pitcher, warning, index }) => (
            <div
              key={pitcher.id}
              className="flex items-start gap-3 rounded-xl border px-4 py-3"
              style={{
                borderColor: warning.type === "traded" ? "#f59e0b" : "#f87171",
                backgroundColor: warning.type === "traded" ? "#fffbeb" : "#fef2f2",
              }}
            >
              <span className="text-base flex-shrink-0 mt-0.5">
                {WARNING_ICONS[warning.type]}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PITCHER_COLORS[index % PITCHER_COLORS.length] }}
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    {pitcher.fullName}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{warning.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="mb-6 rounded-xl bg-gray-50 border border-gray-200 px-5 py-4">
        <h3 className="font-semibold text-gray-900 mb-1">
          Found {sorted.length} home game{sorted.length !== 1 ? "s" : ""} with your selected pitchers
        </h3>
        <p className="text-sm text-gray-500">
          {[
            confirmed > 0 && `${confirmed} confirmed`,
            projected > 0 && `${projected} projected`,
            possible > 0 && `${possible} possible`,
          ]
            .filter(Boolean)
            .join(" \u00B7 ")}
        </p>
      </div>

      {/* Rotation patterns */}
      {rotationInfos.length > 0 && (
        <RotationPattern rotations={rotationInfos} pitcherIndexMap={pitcherIndexMap} />
      )}

      {/* Games grouped by month */}
      {Array.from(byMonth.entries()).map(([month, monthGames]) => (
        <div key={month} className="mb-6">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            {month}
          </h4>
          <div className="flex flex-col gap-3">
            {monthGames.map((game) => (
              <GameCard
                key={`${game.gamePk}-${game.pitcher.id}`}
                game={game}
                pitcherIndex={pitcherIndexMap.get(game.pitcher.id) ?? 0}
                homeTeamName={teamAbbreviation}
                warning={pitcherWarnings.get(game.pitcher.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="mt-8 rounded-xl bg-gray-50 border border-gray-200 px-5 py-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Confidence levels
        </h4>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5" />
            Confirmed &mdash; announced by MLB
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1.5" />
            Projected &mdash; matches rotation pattern
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
            Possible &mdash; within 1 day of projection
          </span>
        </div>
      </div>
    </div>
  );
}
