import type { GameLogSplit, ScheduleGame } from "../src/lib/types";

let pk = 1000;

/** A schedule game with sensible defaults. */
export function game(
  date: string,
  awayId: number,
  homeId: number,
  extra: {
    status?: string;
    abstract?: string;
    awayProbable?: number;
    homeProbable?: number;
    gameNumber?: number;
    doubleHeader?: string;
    gameType?: string;
  } = {}
): ScheduleGame {
  return {
    gamePk: pk++,
    gameType: extra.gameType ?? "R",
    gameDate: `${date}T23:05:00Z`,
    officialDate: date,
    status: {
      detailedState: extra.status ?? "Scheduled",
      abstractGameState: extra.abstract ?? (extra.status === "Final" ? "Final" : "Preview"),
    },
    teams: {
      away: {
        team: { id: awayId, name: `Team ${awayId}` },
        probablePitcher: extra.awayProbable ? { id: extra.awayProbable, fullName: `P${extra.awayProbable}` } : undefined,
      },
      home: {
        team: { id: homeId, name: `Team ${homeId}` },
        probablePitcher: extra.homeProbable ? { id: extra.homeProbable, fullName: `P${extra.homeProbable}` } : undefined,
      },
    },
    venue: { name: "Park" },
    gameNumber: extra.gameNumber ?? 1,
    doubleHeader: extra.doubleHeader ?? "N",
  };
}

export function start(date: string, opponentId = 1, isHome = false): GameLogSplit {
  return { date, stat: { gamesStarted: 1 }, opponent: { id: opponentId, name: `Team ${opponentId}` }, isHome };
}
