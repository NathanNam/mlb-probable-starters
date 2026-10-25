import type {
  GameLogSplit,
  MatchConfidence,
  MatchedGame,
  PitcherWarning,
  RotationInfo,
  RotationStart,
  ScheduleGame,
  SelectedPitcher,
} from "./types";
import { addDays, daysBetween, seasonFromDate } from "./dates";

/** A projection older than this many days since the last start is not trusted. */
const STALE_AFTER_DAYS = 30;
/** A rotation date within this many days of a game counts as "projected". */
export const PROJECTED_WITHIN_DAYS = 1;
/** The rotation card looks this far either side of the projected date. */
export const ROTATION_WINDOW_DAYS = 2;

interface Series {
  games: ScheduleGame[];
}

const DONE_STATE = /final|game over|completed|postponed|cancel|suspended/i;

/** True for games that can still be played as scheduled (not over, postponed or suspended). */
export function isPlayable(game: ScheduleGame): boolean {
  if (game.status.abstractGameState === "Final") return false;
  return !DONE_STATE.test(game.status.detailedState);
}

/** Games from `today` (MLB schedule day) on that can still be played. */
export function upcomingGames(games: ScheduleGame[], today: string): ScheduleGame[] {
  return games
    .filter((g) => g.officialDate >= today && isPlayable(g))
    .sort((a, b) => a.officialDate.localeCompare(b.officialDate) || (a.gameNumber ?? 1) - (b.gameNumber ?? 1));
}

/**
 * Average days between starts. Gaps under 3 or over 10 days (IL stints, the
 * All-Star break, the off-season) are ignored. Defaults to 5.
 */
export function calculateRotationGap(starts: Array<{ date: string }>): number {
  if (starts.length < 2) return 5;
  const sorted = [...starts].sort((a, b) => a.date.localeCompare(b.date));
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1].date, sorted[i].date);
    if (gap >= 3 && gap <= 10) gaps.push(gap);
  }
  if (gaps.length === 0) return 5;
  return Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length);
}

/** Regular-season and postseason starts from a game log, oldest first. */
export function startsFromGameLog(splits: GameLogSplit[]): RotationStart[] {
  const seen = new Set<string>();
  return splits
    .filter((s) => s.stat?.gamesStarted === 1)
    .map((s) => ({
      date: s.date,
      opponent: s.opponent?.name || "Unknown",
      opponentId: s.opponent?.id,
      isHome: s.isHome ?? false,
    }))
    .filter((s) => {
      const key = `${s.date}|${s.opponentId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Group games against `opponentId` into series: consecutive games no more than
 * three days apart (a doubleheader is two games on one day of the same series).
 */
export function groupIntoSeries(games: ScheduleGame[], opponentId: number): Series[] {
  const opponentGames = games
    .filter((g) => g.teams.away.team.id === opponentId)
    .sort((a, b) => a.officialDate.localeCompare(b.officialDate) || (a.gameNumber ?? 1) - (b.gameNumber ?? 1));
  const seriesList: Series[] = [];
  for (const game of opponentGames) {
    const current = seriesList[seriesList.length - 1];
    const prev = current?.games[current.games.length - 1];
    if (prev && daysBetween(prev.officialDate, game.officialDate) <= 3) current.games.push(game);
    else seriesList.push({ games: [game] });
  }
  return seriesList;
}

/** Rotation dates from the last start onward, keeping those from `today` through `until`. */
export function projectedRotationDates(lastStart: string, gap: number, today: string, until: string): string[] {
  if (daysBetween(lastStart, today) > STALE_AFTER_DAYS) return [];
  // A rotation never carries over the winter.
  const seasonEnd = `${seasonFromDate(lastStart)}-11-30`;
  if (until > seasonEnd) until = seasonEnd;
  const dates: string[] = [];
  let current = lastStart;
  for (let i = 0; i < 200; i++) {
    current = addDays(current, gap);
    if (current > until) break;
    if (current >= today) dates.push(current);
  }
  return dates;
}

/** Pick the game in a series closest to a projected rotation date. */
export function findBestGameInSeries(
  games: ScheduleGame[],
  projectedDates: string[]
): { gameIndex: number; confidence: MatchConfidence } {
  if (projectedDates.length === 0) return { gameIndex: 0, confidence: "possible" };
  let bestIndex = 0;
  let bestDiff = Infinity;
  games.forEach((game, gi) => {
    for (const projDate of projectedDates) {
      const diff = Math.abs(daysBetween(game.officialDate, projDate));
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = gi;
      }
    }
  });
  return { gameIndex: bestIndex, confidence: bestDiff <= PROJECTED_WITHIN_DAYS ? "projected" : "possible" };
}

function makeMatchedGame(game: ScheduleGame, pitcher: SelectedPitcher, confidence: MatchConfidence): MatchedGame {
  return {
    gamePk: game.gamePk,
    date: game.officialDate,
    gameDate: game.gameDate,
    startTimeTBD: game.status.startTimeTBD,
    opponent: game.teams.away.team.name,
    opponentId: game.teams.away.team.id,
    venue: game.venue.name,
    pitcher,
    confidence,
    gameNumber: game.gameNumber,
    doubleHeader: game.doubleHeader,
    homePitcher: game.teams.home.probablePitcher
      ? { fullName: game.teams.home.probablePitcher.fullName }
      : undefined,
  };
}

/**
 * Rotation summary for one pitcher: recent starts, average gap and the next
 * start — confirmed by MLB, or projected onto the team's remaining schedule.
 */
export function buildRotationInfo(
  pitcher: SelectedPitcher,
  gameLogSplits: GameLogSplit[],
  today: string,
  pitcherTeamSchedule: ScheduleGame[] = []
): RotationInfo {
  const starts = startsFromGameLog(gameLogSplits);
  const avgGap = calculateRotationGap(starts);
  const lastStart = starts.length > 0 ? starts[starts.length - 1].date : undefined;

  const ownProbable = (g: ScheduleGame) =>
    g.teams.home.team.id === pitcher.teamId ? g.teams.home.probablePitcher : g.teams.away.probablePitcher;
  const futureGames = upcomingGames(pitcherTeamSchedule, today).filter(
    (g) => (g.teams.home.team.id === pitcher.teamId || g.teams.away.team.id === pitcher.teamId) &&
      (!lastStart || g.officialDate > lastStart)
  );

  let nextProjectedStart = "";
  let nextProjectedConfidence: MatchConfidence | undefined;
  let bestGame = futureGames.find((g) => ownProbable(g)?.id === pitcher.id);

  if (bestGame) {
    nextProjectedConfidence = "confirmed";
  } else if (lastStart && futureGames.length > 0 && daysBetween(lastStart, today) <= STALE_AFTER_DAYS) {
    let projected = addDays(lastStart, avgGap);
    while (projected < today) projected = addDays(projected, avgGap);
    nextProjectedStart = projected;
    nextProjectedConfidence = "possible";
    let bestDiff = Infinity;
    for (const game of futureGames) {
      const probable = ownProbable(game);
      if (probable && probable.id !== pitcher.id) continue;
      const diff = Math.abs(daysBetween(game.officialDate, projected));
      if (diff < bestDiff && diff <= ROTATION_WINDOW_DAYS) {
        bestDiff = diff;
        bestGame = game;
      }
    }
    if (bestGame) nextProjectedConfidence = bestDiff <= PROJECTED_WITHIN_DAYS ? "projected" : "possible";
  }

  let nextProjectedOpponent: string | undefined;
  let nextProjectedIsHome: boolean | undefined;
  if (bestGame) {
    const isHome = bestGame.teams.home.team.id === pitcher.teamId;
    nextProjectedStart = bestGame.officialDate;
    nextProjectedOpponent = isHome ? bestGame.teams.away.team.name : bestGame.teams.home.team.name;
    nextProjectedIsHome = isHome;
  }

  return {
    pitcherId: pitcher.id,
    pitcherName: pitcher.fullName,
    pitchHand: pitcher.pitchHand,
    teamName: pitcher.teamName,
    teamId: pitcher.teamId,
    starts,
    avgGap,
    nextProjectedStart,
    nextProjectedOpponent,
    nextProjectedIsHome,
    nextProjectedConfidence: nextProjectedStart ? nextProjectedConfidence : undefined,
    totalStarts: starts.filter((s) => seasonFromDate(s.date) === seasonFromDate(lastStart ?? today)).length,
  };
}

/**
 * Upcoming home games where `pitcher` might start. A starter pitches about once
 * per series, so each remaining series against his team yields one game:
 * confirmed when MLB lists him, otherwise the game nearest his rotation.
 * Games already played, postponed or suspended are skipped.
 */
export function projectPitcherStarts(
  homeGames: ScheduleGame[],
  pitcher: SelectedPitcher,
  gameLogSplits: GameLogSplit[],
  today: string
): MatchedGame[] {
  const remaining = upcomingGames(homeGames, today);
  const seriesList = groupIntoSeries(remaining, pitcher.teamId);
  if (seriesList.length === 0) return [];

  const starts = startsFromGameLog(gameLogSplits);
  const lastGame = remaining[remaining.length - 1].officialDate;
  const projectedDates =
    starts.length >= 2
      ? projectedRotationDates(starts[starts.length - 1].date, calculateRotationGap(starts), today, lastGame)
      : [];

  const results: MatchedGame[] = [];
  for (const series of seriesList) {
    const confirmed = series.games.filter((g) => g.teams.away.probablePitcher?.id === pitcher.id);
    if (confirmed.length > 0) {
      for (const g of confirmed) results.push(makeMatchedGame(g, pitcher, "confirmed"));
      continue;
    }
    const open = series.games.filter((g) => !g.teams.away.probablePitcher);
    if (open.length === 0) continue; // every game already has another starter listed
    const { gameIndex, confidence } = findBestGameInSeries(open, projectedDates);
    results.push(makeMatchedGame(open[gameIndex], pitcher, confidence));
  }
  return results;
}

/**
 * Inactivity warning ("may be on the IL"), only while the regular season is
 * under way for the pitcher's team — never in spring, October or winter.
 */
export function inactivityWarning(
  starts: RotationStart[],
  teamSchedule: ScheduleGame[],
  today: string
): PitcherWarning | null {
  const regular = teamSchedule
    .filter((g) => (g.gameType ?? "R") === "R")
    .map((g) => g.officialDate)
    .sort();
  if (regular.length === 0) return null;
  const first = regular[0];
  const last = regular[regular.length - 1];
  if (today < first || today > last) return null;

  const season = seasonFromDate(today);
  const thisSeason = starts.filter((s) => seasonFromDate(s.date) === season);
  if (thisSeason.length > 0) {
    const lastStart = thisSeason[thisSeason.length - 1].date;
    const days = daysBetween(lastStart, today);
    return days > 15
      ? { type: "inactive", message: `Last start was ${lastStart} (${days} days ago) — may be on the IL` }
      : null;
  }
  return daysBetween(first, today) >= 21
    ? { type: "no_starts", message: `No starts in ${season} yet — may be on the IL or in the minors` }
    : null;
}
