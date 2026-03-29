"use client";

import type { MatchedGame, MatchConfidence, PitcherWarning } from "@/lib/types";

const PITCHER_COLORS = [
  "#2563eb", "#dc2626", "#059669", "#7c3aed",
  "#d97706", "#0891b2", "#be185d", "#4f46e5",
];

const CONFIDENCE_STYLES: Record<MatchConfidence, { label: string; bg: string; text: string }> = {
  confirmed: { label: "Confirmed", bg: "bg-green-100", text: "text-green-800" },
  projected: { label: "Projected", bg: "bg-blue-100", text: "text-blue-800" },
  possible: { label: "Possible", bg: "bg-amber-100", text: "text-amber-800" },
};

interface GameCardProps {
  game: MatchedGame;
  pitcherIndex: number;
  homeTeamName: string;
  warning?: PitcherWarning;
}

export default function GameCard({ game, pitcherIndex, homeTeamName, warning }: GameCardProps) {
  const conf = CONFIDENCE_STYLES[game.confidence];
  const gameDate = new Date(game.date + "T12:00:00Z");
  const dayName = gameDate.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const monthDay = gameDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  const ticketUrl = `https://www.mlb.com/gameday/${game.gamePk}`;

  return (
    <a
      href={ticketUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm
                 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
    >
      {/* Date */}
      <div className="text-center min-w-[60px]">
        <div className="text-xs font-medium text-gray-500 uppercase">{dayName}</div>
        <div className="text-lg font-bold text-gray-900">{monthDay}</div>
      </div>

      {/* Divider */}
      <div className="w-px h-10 bg-gray-200" />

      {/* Matchup */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">
          vs {game.opponent}
        </div>

        {/* Pitching matchup */}
        <div className="mt-1.5 flex flex-col gap-1">
          {/* Home pitcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 w-8 flex-shrink-0">{homeTeamName}</span>
            <span className="text-sm text-gray-600 truncate">
              {game.homePitcher ? game.homePitcher.fullName : "TBD"}
            </span>
          </div>
          {/* Away pitcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 w-8 flex-shrink-0">vs</span>
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: PITCHER_COLORS[pitcherIndex % PITCHER_COLORS.length] }}
            />
            <span className="text-sm font-medium text-gray-800 truncate">
              {game.pitcher.fullName} ({game.pitcher.pitchHand}HP)
            </span>
          </div>
        </div>
      </div>

      {/* Badges + ticket hint */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${conf.bg} ${conf.text}`}>
          {conf.label}
        </span>
        {warning && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-600">
            {warning.type === "traded" ? "Traded" : warning.type === "inactive" ? "IL?" : "No starts"}
          </span>
        )}
        <span className="text-xs text-gray-400 group-hover:text-blue-500 transition-colors mt-0.5">
          Tickets &rarr;
        </span>
      </div>
    </a>
  );
}
