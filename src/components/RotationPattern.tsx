"use client";

import type { RotationInfo } from "@/lib/types";

const PITCHER_COLORS = [
  "#2563eb", "#dc2626", "#059669", "#7c3aed",
  "#d97706", "#0891b2", "#be185d", "#4f46e5",
];

interface RotationPatternProps {
  rotations: RotationInfo[];
  pitcherIndexMap: Map<number, number>;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

export default function RotationPattern({ rotations, pitcherIndexMap }: RotationPatternProps) {
  if (rotations.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mb-6">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Rotation Patterns
      </h4>
      <div className="flex flex-col gap-3">
        {rotations.map((rot) => {
          const colorIdx = pitcherIndexMap.get(rot.pitcherId) ?? 0;
          const color = PITCHER_COLORS[colorIdx % PITCHER_COLORS.length];
          const recentStarts = rot.starts.slice(-5); // last 5 starts

          return (
            <div
              key={rot.pitcherId}
              className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    {rot.pitcherName}
                  </span>
                  <span className="text-xs text-gray-400">
                    {rot.pitchHand}HP
                  </span>
                  <span className="text-xs text-gray-400">
                    &middot; {rot.teamName}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500">
                    {rot.totalStarts} start{rot.totalStarts !== 1 ? "s" : ""}
                  </span>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    Every {rot.avgGap} days
                  </span>
                </div>
              </div>

              {/* Recent starts timeline */}
              {recentStarts.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {recentStarts.map((start, i) => (
                    <div key={start.date} className="flex items-center">
                      <div className="flex flex-col items-center px-2 py-1.5 rounded-lg bg-gray-50 min-w-[72px]">
                        <span className="text-[10px] font-medium text-gray-400">
                          {formatDay(start.date)}
                        </span>
                        <span className="text-xs font-semibold text-gray-700">
                          {formatDate(start.date)}
                        </span>
                        <span className="text-[10px] text-gray-500 mt-0.5">
                          {start.isHome ? "vs" : "@"} {start.opponent.replace(/^(.*?\s)/, "").slice(0, 12)}
                        </span>
                      </div>
                      {i < recentStarts.length - 1 && (
                        <div className="flex flex-col items-center mx-0.5">
                          <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Next projected */}
                  {rot.nextProjectedStart && (
                    <>
                      <div className="flex flex-col items-center mx-0.5">
                        <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <div className="flex flex-col items-center px-2 py-1.5 rounded-lg min-w-[72px] border border-dashed" style={{ borderColor: color, backgroundColor: `${color}08` }}>
                        <span className="text-[10px] font-medium text-gray-400">
                          {formatDay(rot.nextProjectedStart)}
                        </span>
                        <span className="text-xs font-semibold" style={{ color }}>
                          {formatDate(rot.nextProjectedStart)}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5">
                          projected
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {recentStarts.length === 0 && (
                <p className="text-xs text-gray-400">No starts this season yet</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
