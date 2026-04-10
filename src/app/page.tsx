"use client";

import { useState, useEffect, useCallback } from "react";
import TeamPicker from "@/components/TeamPicker";
import PitcherSearch from "@/components/PitcherSearch";
import ScheduleResults from "@/components/ScheduleResults";
import type { SelectedPitcher, MatchedGame, ScheduleGame, PitcherWarning, RotationInfo } from "@/lib/types";
import { projectPitcherStarts, buildRotationInfo } from "@/lib/projection";

interface Team {
  id: number;
  name: string;
  abbreviation: string;
  division: { id: number; name: string };
  league: { id: number; name: string };
}

const CURRENT_SEASON = 2026;
const STORAGE_KEY = "mlb-pitcher-tracker";

function loadSaved(): { team: Team | null; pitchers: SelectedPitcher[] } {
  if (typeof window === "undefined") return { team: null, pitchers: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { team: null, pitchers: [] };
    const data = JSON.parse(raw);
    return {
      team: data.team || null,
      pitchers: data.pitchers || [],
    };
  } catch {
    return { team: null, pitchers: [] };
  }
}

export default function Home() {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedPitchers, setSelectedPitchers] = useState<SelectedPitcher[]>([]);
  const [results, setResults] = useState<MatchedGame[] | null>(null);
  const [rotationInfos, setRotationInfos] = useState<RotationInfo[]>([]);
  const [pitcherWarnings, setPitcherWarnings] = useState<Map<number, PitcherWarning>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Load saved selections on mount
  useEffect(() => {
    const saved = loadSaved();
    if (saved.team) setSelectedTeam(saved.team);
    if (saved.pitchers.length > 0) setSelectedPitchers(saved.pitchers);
    setHydrated(true);
  }, []);

  // Persist selections to localStorage
  const persist = useCallback((team: Team | null, pitchers: SelectedPitcher[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ team, pitchers }));
    } catch { /* storage full or unavailable */ }
  }, []);

  const handleAddPitcher = (pitcher: SelectedPitcher) => {
    setSelectedPitchers((prev) => {
      const next = [...prev, pitcher];
      persist(selectedTeam, next);
      return next;
    });
    setResults(null);
  };

  const handleRemovePitcher = (id: number) => {
    setSelectedPitchers((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persist(selectedTeam, next);
      return next;
    });
    setResults(null);
    setPitcherWarnings((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const handleFindGames = async () => {
    if (!selectedTeam || selectedPitchers.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch home team schedule
      const scheduleRes = await fetch(
        `/api/schedule?teamId=${selectedTeam.id}&season=${CURRENT_SEASON}`
      );
      const scheduleData = await scheduleRes.json();
      const allGames: ScheduleGame[] = scheduleData.games || [];

      // Filter to home games only
      const homeGames = allGames.filter(
        (g) => g.teams.home.team.id === selectedTeam.id
      );

      const allMatches: MatchedGame[] = [];
      const allRotations: RotationInfo[] = [];
      const warnings = new Map<number, PitcherWarning>();

      await Promise.all(
        selectedPitchers.map(async (pitcher) => {
          // Fetch current player info to check roster status
          const playerRes = await fetch(`/api/player/${pitcher.id}`);
          const playerData = await playerRes.json();
          const currentPlayer = playerData.player;

          // Check if traded or released
          if (currentPlayer?.currentTeam) {
            if (currentPlayer.currentTeam.id !== pitcher.teamId) {
              warnings.set(pitcher.id, {
                type: "traded",
                message: `Now on ${currentPlayer.currentTeam.name} (was ${pitcher.teamName})`,
              });
              // Update pitcher's team for correct series matching
              pitcher = {
                ...pitcher,
                teamId: currentPlayer.currentTeam.id,
                teamName: currentPlayer.currentTeam.name,
              };
            }
          } else if (currentPlayer && !currentPlayer.currentTeam) {
            warnings.set(pitcher.id, {
              type: "inactive",
              message: "No longer on an active roster",
            });
          }

          // Fetch current season game log
          const logRes = await fetch(
            `/api/gamelog?playerId=${pitcher.id}&season=${CURRENT_SEASON}`
          );
          const logData = await logRes.json();
          let splits = logData.splits || [];

          const currentSeasonStarts = splits.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (s: any) => s.stat?.gamesStarted === 1
          );

          // Check for inactivity mid-season
          if (currentSeasonStarts.length > 0) {
            const lastStart = currentSeasonStarts
              .map((s: { date: string }) => s.date)
              .sort()
              .pop();
            const today = new Date().toISOString().split("T")[0];
            const daysSinceLastStart = Math.round(
              (new Date(today).getTime() - new Date(lastStart).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            if (daysSinceLastStart > 15 && !warnings.has(pitcher.id)) {
              warnings.set(pitcher.id, {
                type: "inactive",
                message: `Last start was ${lastStart} (${daysSinceLastStart} days ago) — may be on IL`,
              });
            }
          } else {
            // No starts this season — only flag if season has been underway for 3+ weeks
            const completedGames = allGames
              .filter((g) => g.status.detailedState === "Final")
              .sort((a, b) => a.officialDate.localeCompare(b.officialDate));
            if (completedGames.length > 0) {
              const firstGameDate = new Date(completedGames[0].officialDate);
              const daysSinceSeasonStart = Math.round(
                (new Date().getTime() - firstGameDate.getTime()) / (1000 * 60 * 60 * 24)
              );
              if (daysSinceSeasonStart >= 21 && !warnings.has(pitcher.id)) {
                warnings.set(pitcher.id, {
                  type: "no_starts",
                  message: `No starts in ${CURRENT_SEASON} yet — may be on IL or in minors`,
                });
              }
            }
          }

          // Fetch previous season if needed
          if (currentSeasonStarts.length < 3) {
            const prevRes = await fetch(
              `/api/gamelog?playerId=${pitcher.id}&season=${CURRENT_SEASON - 1}`
            );
            const prevData = await prevRes.json();
            const prevSplits = prevData.splits || [];
            splits = [...prevSplits, ...splits];
          }

          // Build rotation pattern info from current season data
          const rotInfo = buildRotationInfo(pitcher, splits, CURRENT_SEASON);
          allRotations.push(rotInfo);

          const matches = projectPitcherStarts(
            homeGames,
            pitcher,
            splits,
            CURRENT_SEASON
          );
          allMatches.push(...matches);
        })
      );

      setPitcherWarnings(warnings);
      setRotationInfos(allRotations);
      setResults(allMatches);
    } catch (err) {
      console.error("Error finding games:", err);
      setError("Failed to fetch schedule data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">
            MLB Home Game Pitcher Tracker
          </h1>
          <p className="text-gray-500 mt-1">
            Find home games where your favorite opposing pitchers are likely to start
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-8">
          {/* Step 1: Team Selection */}
          <section className="w-full max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold">
                1
              </span>
              <h2 className="text-lg font-semibold text-gray-900">
                Pick your home team
              </h2>
            </div>
            <TeamPicker
              onSelect={(team) => {
                setSelectedTeam(team);
                setResults(null);
                setPitcherWarnings(new Map());
                persist(team, selectedPitchers);
              }}
              selectedTeam={selectedTeam}
            />
          </section>

          {/* Step 2: Pitcher Selection */}
          {selectedTeam && (
            <section className="w-full max-w-md">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold">
                  2
                </span>
                <h2 className="text-lg font-semibold text-gray-900">
                  Select opponent starting pitchers
                </h2>
              </div>
              <PitcherSearch
                selectedPitchers={selectedPitchers}
                onAdd={handleAddPitcher}
                onRemove={handleRemovePitcher}
              />
            </section>
          )}

          {/* Find Games Button */}
          {selectedTeam && selectedPitchers.length > 0 && (
            <button
              onClick={handleFindGames}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white
                         shadow-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed
                         transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Finding games...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Find Games
                </>
              )}
            </button>
          )}

          {/* Error */}
          {error && (
            <div className="w-full max-w-2xl rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-red-700">
              {error}
            </div>
          )}

          {/* Step 3: Results */}
          {results !== null && (
            <section className="w-full flex flex-col items-center">
              <div className="flex items-center gap-2 mb-6">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold">
                  3
                </span>
                <h2 className="text-lg font-semibold text-gray-900">
                  Home games at {selectedTeam?.name}
                </h2>
              </div>
              <ScheduleResults
                games={results}
                pitchers={selectedPitchers}
                teamName={selectedTeam?.name || ""}
                teamAbbreviation={selectedTeam?.abbreviation || ""}
                pitcherWarnings={pitcherWarnings}
                rotationInfos={rotationInfos}
              />
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16 py-6">
        <p className="text-center text-sm text-gray-400">
          Pitcher projections are estimates based on rotation patterns. Confirmed starters are sourced from MLB.
        </p>
      </footer>
    </div>
  );
}
