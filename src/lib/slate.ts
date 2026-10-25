// Turns a schedule day plus the starters' season lines into card-ready games.

import type { ApiTeamSide, ScheduleGame } from "./types";
import type { ApiPerson, PeopleResponse, PitchingStat, ScheduleResponse } from "./statsapi";
import { flattenSchedule, seasonLineOf } from "./statsapi";
import { teamOrFallback, type Team } from "./teams";

export type StatusKind = "scheduled" | "live" | "final" | "postponed" | "suspended" | "cancelled" | "delayed";

export interface PitcherLine {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  number?: string;
  hand: string; // L | R
  /** Season line entering the game; undefined before the pitcher's first appearance. */
  stats?: {
    wins: number;
    losses: number;
    era: string;
    whip: string;
    strikeOuts: number;
    gamesStarted: number;
    inningsPitched: string;
    kPer9?: string;
  };
}

export interface SlateSide {
  team: Team;
  record?: string;
  score?: number;
  isWinner?: boolean;
  pitcher?: PitcherLine;
}

export interface SlateGame {
  gamePk: number;
  gameDate: string;
  officialDate: string;
  gameType: string;
  isPostseason: boolean;
  status: { kind: StatusKind; label: string; reason?: string };
  startTimeTBD: boolean;
  venue: string;
  doubleHeader: boolean;
  gameNumber: number;
  seriesLabel?: string; // "World Series · Game 3"
  seriesNote?: string; // "MIL leads 2-0"
  ifNecessary: boolean;
  away: SlateSide;
  home: SlateSide;
}

export const POSTSEASON_TYPES = new Set(["F", "D", "L", "W"]);

/** Innings like "146.2" mean 146 and 2/3. */
export function inningsToNumber(ip: string | undefined): number {
  if (!ip) return 0;
  const [whole, outs = "0"] = ip.split(".");
  return Number(whole) + Number(outs) / 3;
}

export function kPer9(strikeOuts: number, ip: string | undefined): string | undefined {
  const innings = inningsToNumber(ip);
  return innings > 0 ? ((strikeOuts * 9) / innings).toFixed(1) : undefined;
}

export function statusOf(game: ScheduleGame): SlateGame["status"] {
  const detailed = game.status.detailedState || "Scheduled";
  const reason = game.status.reason;
  if (/postponed/i.test(detailed)) return { kind: "postponed", label: "Postponed", reason };
  if (/suspended/i.test(detailed)) return { kind: "suspended", label: "Suspended", reason };
  if (/cancel/i.test(detailed)) return { kind: "cancelled", label: "Cancelled", reason };
  if (game.status.abstractGameState === "Final" || /final|game over|completed/i.test(detailed))
    return { kind: "final", label: "Final" };
  if (/delay/i.test(detailed)) return { kind: "delayed", label: detailed, reason };
  if (game.status.abstractGameState === "Live") return { kind: "live", label: detailed === "Warmup" ? "Warmup" : "Live" };
  return { kind: "scheduled", label: detailed };
}

function toLine(person: ApiPerson | undefined, probable: { id: number; fullName: string }): PitcherLine {
  const fullName = person?.fullName ?? probable.fullName;
  const lastName = person?.useLastName ?? person?.lastName ?? fullName.split(" ").slice(-1)[0];
  const firstName = person?.useName ?? person?.firstName ?? fullName.split(" ").slice(0, -1).join(" ");
  const stat: PitchingStat | undefined = seasonLineOf(person);
  const hasStats = !!stat && (stat.gamesPlayed ?? 0) > 0;
  return {
    id: probable.id,
    fullName,
    firstName,
    lastName,
    number: person?.primaryNumber,
    hand: person?.pitchHand?.code ?? "",
    stats: hasStats
      ? {
          wins: stat.wins ?? 0,
          losses: stat.losses ?? 0,
          era: stat.era ?? "-.--",
          whip: stat.whip ?? "-.--",
          strikeOuts: stat.strikeOuts ?? 0,
          gamesStarted: stat.gamesStarted ?? 0,
          inningsPitched: stat.inningsPitched ?? "0.0",
          kPer9: kPer9(stat.strikeOuts ?? 0, stat.inningsPitched),
        }
      : undefined,
  };
}

function side(raw: ApiTeamSide, people: Map<number, ApiPerson>): SlateSide {
  const rec = raw.leagueRecord;
  return {
    team: teamOrFallback(raw.team.id, raw.team.name),
    record: rec ? `${rec.wins}-${rec.losses}` : undefined,
    score: raw.score,
    isWinner: raw.isWinner,
    pitcher: raw.probablePitcher ? toLine(people.get(raw.probablePitcher.id), raw.probablePitcher) : undefined,
  };
}

/** IDs of every listed starter in a schedule response. */
export function probableIds(schedule: ScheduleResponse): number[] {
  const ids = new Set<number>();
  for (const g of flattenSchedule(schedule)) {
    for (const s of [g.teams.away, g.teams.home]) if (s.probablePitcher) ids.add(s.probablePitcher.id);
  }
  return [...ids];
}

export function toSlateGame(g: ScheduleGame, people: Map<number, ApiPerson> = new Map()): SlateGame {
  const gameType = g.gameType ?? "R";
  const isPostseason = POSTSEASON_TYPES.has(gameType);
  const seriesName = g.seriesStatus?.shortDescription ?? g.description;
  return {
    gamePk: g.gamePk,
    gameDate: g.gameDate,
    officialDate: g.officialDate,
    gameType,
    isPostseason,
    status: statusOf(g),
    startTimeTBD: !!g.status.startTimeTBD,
    venue: g.venue?.name ?? "",
    doubleHeader: !!g.doubleHeader && g.doubleHeader !== "N",
    gameNumber: g.gameNumber ?? 1,
    seriesLabel: isPostseason && seriesName ? seriesName.replace(/ Game (\d+)$/, " · Game $1") : undefined,
    seriesNote: isPostseason ? g.seriesStatus?.result : undefined,
    ifNecessary: g.ifNecessary === "Y",
    away: side(g.teams.away, people),
    home: side(g.teams.home, people),
  };
}

/** Card-ready games for one schedule day, in start-time order. */
export function assembleSlate(schedule: ScheduleResponse, people?: PeopleResponse | null): SlateGame[] {
  const byId = new Map((people?.people ?? []).map((p) => [p.id, p]));
  return flattenSchedule(schedule)
    .map((g) => toSlateGame(g, byId))
    .sort(
      (a, b) =>
        a.gameDate.localeCompare(b.gameDate) ||
        a.gameNumber - b.gameNumber ||
        a.gamePk - b.gamePk
    );
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Slate filtered to one club and/or a starter whose name contains `query`. */
export function filterSlate(games: SlateGame[], teamId?: number, query = ""): SlateGame[] {
  const q = fold(query.trim());
  return games.filter((g) => {
    if (teamId && g.away.team.id !== teamId && g.home.team.id !== teamId) return false;
    if (!q) return true;
    return [g.away.pitcher?.fullName, g.home.pitcher?.fullName].some((n) => n && fold(n).includes(q));
  });
}
