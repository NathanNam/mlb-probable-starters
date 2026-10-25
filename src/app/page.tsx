"use client";

import { useState, useSyncExternalStore, useCallback } from "react";
import TeamPicker from "@/components/TeamPicker";
import PitcherSearch from "@/components/PitcherSearch";
import ScheduleResults from "@/components/ScheduleResults";
import type { SelectedPitcher, MatchedGame, ScheduleGame, PitcherWarning, RotationInfo, GameLogSplit } from "@/lib/types";
import { projectPitcherStarts, buildRotationInfo, inactivityWarning, startsFromGameLog } from "@/lib/projection";
import { todayET, upcomingSeason } from "@/lib/dates";
import { getJson } from "@/lib/http";
import { teamById, type Team } from "@/lib/teams";

const STORAGE_KEY = "mlb-pitcher-tracker";

function loadSaved(): { team: Team | null; pitchers: SelectedPitcher[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { team: null, pitchers: [] };
    const data = JSON.parse(raw);
    return {
      team: teamById(data.team?.id) ?? null,
      pitchers: Array.isArray(data.pitchers) ? data.pitchers : [],
    };
  } catch {
    return { team: null, pitchers: [] };
  }
}

const noopSubscribe = () => () => {};

export default function Home() {
  // Render the tracker only in the browser, where saved selections are readable.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }
  return <Tracker initial={loadSaved()} />;
}

function Tracker({ initial }: { initial: { team: Team | null; pitchers: SelectedPitcher[] } }) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(initial.team);
  const [selectedPitchers, setSelectedPitchers] = useState<SelectedPitcher[]>(initial.pitchers);
  const [results, setResults] = useState<MatchedGame[] | null>(null);
  const [rotationInfos, setRotationInfos] = useState<RotationInfo[]>([]);
  const [pitcherWarnings, setPitcherWarnings] = useState<Map<number, PitcherWarning>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback((team: Team | null, pitchers: SelectedPitcher[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ team, pitchers }));
    } catch { /* storage full or unavailable */ }
  }, []);

  const handleAddPitcher = (pitcher: SelectedPitcher) => {
    const next = [...selectedPitchers, pitcher];
    setSelectedPitchers(next);
    persist(selectedTeam, next);
    setResults(null);
  };

  const handleRemovePitcher = (id: number) => {
    const next = selectedPitchers.filter((p) => p.id !== id);
    setSelectedPitchers(next);
    persist(selectedTeam, next);
    setResults(null);
    setPitcherWarnings((prev) => {
      const m = new Map(prev);
      m.delete(id);
      return m;
    });
  };

  const handleFindGames = async () => {
    if (!selectedTeam || selectedPitchers.length === 0) return;
    setIsLoading(true);
    setError(null);
    const today = todayET();
    const season = upcomingSeason(today);

    try {
      const scheduleData = await getJson<{ games: ScheduleGame[] }>(
        `/api/schedule?teamId=${selectedTeam.id}&season=${season}`
      );
      const homeGames = scheduleData.games.filter((g) => g.teams.home.team.id === selectedTeam.id);
      const warnings = new Map<number, PitcherWarning>();

      const perPitcher = await Promise.all(
        selectedPitchers.map(async (saved) => {
          let pitcher = saved;
          const { player } = await getJson<{ player?: { currentTeam?: { id: number; name: string } } }>(
            `/api/player/${pitcher.id}`
          );
          if (player?.currentTeam && player.currentTeam.id !== pitcher.teamId) {
            warnings.set(pitcher.id, {
              type: "traded",
              message: `Now on the ${player.currentTeam.name} (was ${pitcher.teamName})`,
            });
            pitcher = { ...pitcher, teamId: player.currentTeam.id, teamName: player.currentTeam.name };
          } else if (player && !player.currentTeam) {
            warnings.set(pitcher.id, { type: "inactive", message: "No longer on an active roster" });
          }

          let { splits } = await getJson<{ splits: GameLogSplit[] }>(
            `/api/gamelog?playerId=${pitcher.id}&season=${season}`
          );
          if (startsFromGameLog(splits).length < 3) {
            const prev = await getJson<{ splits: GameLogSplit[] }>(
              `/api/gamelog?playerId=${pitcher.id}&season=${season - 1}`
            );
            splits = [...prev.splits, ...splits];
          }

          const teamSchedule =
            pitcher.teamId === selectedTeam.id
              ? scheduleData.games
              : (await getJson<{ games: ScheduleGame[] }>(`/api/schedule?teamId=${pitcher.teamId}&season=${season}`)).games;

          const warning = inactivityWarning(startsFromGameLog(splits), teamSchedule, today);
          if (warning && !warnings.has(pitcher.id)) warnings.set(pitcher.id, warning);

          return {
            pitcher,
            rotation: buildRotationInfo(pitcher, splits, today, teamSchedule),
            matches: projectPitcherStarts(homeGames, pitcher, splits, today),
          };
        })
      );

      // Keep a traded pitcher's new team for next time.
      const updated = perPitcher.map((r) => r.pitcher);
      if (updated.some((p, i) => p.teamId !== selectedPitchers[i].teamId)) {
        setSelectedPitchers(updated);
        persist(selectedTeam, updated);
      }

      setPitcherWarnings(warnings);
      setRotationInfos(perPitcher.map((r) => r.rotation)); // same order as the chips
      setResults(perPitcher.flatMap((r) => r.matches));
    } catch (err) {
      console.error("Error finding games:", err);
      setResults(null);
      setError("Couldn't load the schedule from MLB just now. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

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
                teamAbbreviation={selectedTeam?.abbr || ""}
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
