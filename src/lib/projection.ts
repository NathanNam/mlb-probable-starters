import type { ScheduleGame, SelectedPitcher, MatchedGame, MatchConfidence } from "./types";

interface StartEntry {
  date: string; // YYYY-MM-DD
}

interface Series {
  games: ScheduleGame[];
  startDate: string;
  endDate: string;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T12:00:00Z");
  const db = new Date(b + "T12:00:00Z");
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * Calculate average rotation gap from a list of start dates.
 * Discards outlier gaps (<3 or >10 days) to ignore IL stints, all-star breaks, etc.
 * Returns 5 as default if insufficient data.
 */
export function calculateRotationGap(starts: StartEntry[]): number {
  if (starts.length < 2) return 5;

  const sorted = [...starts].sort((a, b) => a.date.localeCompare(b.date));
  const gaps: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1].date, sorted[i].date);
    if (gap >= 3 && gap <= 10) {
      gaps.push(gap);
    }
  }

  if (gaps.length === 0) return 5;
  return Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length);
}

/**
 * Group home games by opponent into series.
 * A series is a set of consecutive games (within 3 days of each other) against the same team.
 */
function groupIntoSeries(games: ScheduleGame[], opponentId: number): Series[] {
  const opponentGames = games
    .filter((g) => g.teams.away.team.id === opponentId)
    .sort((a, b) => a.officialDate.localeCompare(b.officialDate));

  if (opponentGames.length === 0) return [];

  const seriesList: Series[] = [];
  let currentSeries: ScheduleGame[] = [opponentGames[0]];

  for (let i = 1; i < opponentGames.length; i++) {
    const prevDate = opponentGames[i - 1].officialDate;
    const currDate = opponentGames[i].officialDate;
    const gap = daysBetween(prevDate, currDate);

    if (gap <= 3) {
      // Same series (accounts for off-days within a series)
      currentSeries.push(opponentGames[i]);
    } else {
      // New series
      seriesList.push({
        games: currentSeries,
        startDate: currentSeries[0].officialDate,
        endDate: currentSeries[currentSeries.length - 1].officialDate,
      });
      currentSeries = [opponentGames[i]];
    }
  }

  seriesList.push({
    games: currentSeries,
    startDate: currentSeries[0].officialDate,
    endDate: currentSeries[currentSeries.length - 1].officialDate,
  });

  return seriesList;
}

/**
 * For a given series, find which game the pitcher most likely starts
 * based on rotation projection. Returns the game index.
 */
function findBestGameInSeries(
  series: Series,
  projectedDates: string[]
): { gameIndex: number; confidence: MatchConfidence } {
  if (projectedDates.length === 0 || series.games.length === 1) {
    return { gameIndex: 0, confidence: "possible" };
  }

  // Find the projected date closest to any game in this series
  let bestIndex = 0;
  let bestDiff = Infinity;

  for (let gi = 0; gi < series.games.length; gi++) {
    const gameDate = series.games[gi].officialDate;
    for (const projDate of projectedDates) {
      const diff = Math.abs(daysBetween(gameDate, projDate));
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = gi;
      }
    }
  }

  // Confidence based on how close the projection aligns
  const confidence: MatchConfidence =
    bestDiff === 0 ? "projected" : bestDiff <= 1 ? "projected" : "possible";

  return { gameIndex: bestIndex, confidence };
}

function makeMatchedGame(
  game: ScheduleGame,
  pitcher: SelectedPitcher,
  confidence: MatchConfidence
): MatchedGame {
  return {
    gamePk: game.gamePk,
    date: game.officialDate,
    gameDate: game.gameDate,
    opponent: game.teams.away.team.name,
    venue: game.venue.name,
    pitcher,
    confidence,
    homePitcher: game.teams.home.probablePitcher
      ? { fullName: game.teams.home.probablePitcher.fullName }
      : undefined,
  };
}

/**
 * Full projection pipeline for a single pitcher against a home team's schedule.
 * Uses series-based matching: a starter pitches once per series.
 */
export function projectPitcherStarts(
  homeGames: ScheduleGame[],
  pitcher: SelectedPitcher,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameLogSplits: any[],
  season: number
): MatchedGame[] {
  // Group home games into series against the pitcher's team
  const seriesList = groupIntoSeries(homeGames, pitcher.teamId);
  if (seriesList.length === 0) return [];

  // Extract starts from game log
  const starts: StartEntry[] = gameLogSplits
    .filter((s) => s.stat?.gamesStarted === 1)
    .map((s) => ({ date: s.date }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Build projected dates for alignment within series
  let projectedDates: string[] = [];
  if (starts.length >= 2) {
    const avgGap = calculateRotationGap(starts);
    const lastStart = starts[starts.length - 1].date;
    const seasonEnd = `${season}-10-05`;

    let current = lastStart;
    while (true) {
      current = addDays(current, avgGap);
      if (current > seasonEnd) break;
      projectedDates.push(current);
    }
  }

  const results: MatchedGame[] = [];

  for (const series of seriesList) {
    // Check for confirmed starters in this series
    let hasConfirmed = false;
    let allGamesHaveOtherPitcher = true;

    for (const game of series.games) {
      const awayProbable = game.teams.away.probablePitcher;
      if (awayProbable?.id === pitcher.id) {
        // This pitcher is confirmed for this game
        results.push(makeMatchedGame(game, pitcher, "confirmed"));
        hasConfirmed = true;
        allGamesHaveOtherPitcher = false;
      } else if (!awayProbable) {
        allGamesHaveOtherPitcher = false;
      }
    }

    // If we already have a confirmed start in this series, skip projection
    if (hasConfirmed) continue;

    // If all games have a different confirmed pitcher, skip this series
    if (allGamesHaveOtherPitcher) continue;

    // Find unconfirmed games in this series
    const unconfirmedGames = series.games.filter(
      (g) => !g.teams.away.probablePitcher
    );

    if (unconfirmedGames.length === 0) continue;

    // Build a mini-series of just unconfirmed games for projection
    const miniSeries: Series = {
      games: unconfirmedGames,
      startDate: unconfirmedGames[0].officialDate,
      endDate: unconfirmedGames[unconfirmedGames.length - 1].officialDate,
    };

    // Pick the best game in the series based on rotation alignment
    const { gameIndex, confidence } = findBestGameInSeries(miniSeries, projectedDates);
    results.push(makeMatchedGame(unconfirmedGames[gameIndex], pitcher, confidence));
  }

  return results;
}
