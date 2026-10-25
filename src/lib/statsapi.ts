// Browser-side client for the public MLB Stats API (statsapi.mlb.com).
// Plain GETs with no custom headers, so the browser makes no CORS preflight.

import type { GameLogSplit, ScheduleGame } from "./types";
import { getJson } from "./http";
import { cached } from "./cache";
import { addDays } from "./dates";

export const STATSAPI = "https://statsapi.mlb.com/api/v1";
/** Regular season plus every postseason round (wild card, division, LCS, World Series). */
export const GAME_TYPES = "R,F,D,L,W";

const SCHEDULE_FIELDS = [
  "dates", "date", "games", "gamePk", "gameType", "gameDate", "officialDate", "status",
  "detailedState", "abstractGameState", "codedGameState", "startTimeTBD", "reason", "teams", "away",
  "home", "team", "id", "name", "probablePitcher", "fullName", "score", "isWinner", "leagueRecord",
  "wins", "losses", "venue", "doubleHeader", "gameNumber", "seriesStatus", "result",
  "shortDescription", "description", "seriesDescription", "seriesGameNumber", "gamesInSeries",
  "ifNecessary",
].join(",");

/** Two minutes keeps probable pitchers and scores fresh without refetching on every click. */
const TTL_MS = 2 * 60 * 1000;

export function apiGet<T>(path: string, ttlMs = TTL_MS): Promise<T> {
  const url = `${STATSAPI}${path}`;
  return cached(url, ttlMs, () => getJson<T>(url));
}

export interface ScheduleResponse {
  dates?: Array<{ date: string; games: ScheduleGame[] }>;
}

export function flattenSchedule(data: ScheduleResponse): ScheduleGame[] {
  return (data.dates ?? []).flatMap((d) => d.games ?? []);
}

/** Every game on one MLB schedule day. */
export function scheduleUrlForDate(date: string): string {
  return `/schedule?sportId=1&date=${date}&gameType=${GAME_TYPES}&hydrate=probablePitcher,seriesStatus&fields=${SCHEDULE_FIELDS}`;
}

export function fetchScheduleForDate(date: string): Promise<ScheduleResponse> {
  return apiGet<ScheduleResponse>(scheduleUrlForDate(date));
}

/** Games in a date range (all clubs, or one club). */
export async function fetchScheduleRange(startDate: string, endDate: string, teamId?: number): Promise<ScheduleGame[]> {
  const team = teamId ? `&teamId=${teamId}` : "";
  const data = await apiGet<ScheduleResponse>(
    `/schedule?sportId=1${team}&startDate=${startDate}&endDate=${endDate}&gameType=${GAME_TYPES}` +
      `&hydrate=probablePitcher,seriesStatus&fields=${SCHEDULE_FIELDS}`
  );
  return flattenSchedule(data);
}

/** One club's whole season (spring through the end of the postseason window). */
export function fetchTeamSeason(teamId: number, season: number): Promise<ScheduleGame[]> {
  return fetchScheduleRange(`${season}-02-01`, `${season}-11-30`, teamId);
}

export interface SeasonInfo {
  seasonId: string;
  springStartDate?: string;
  regularSeasonStartDate?: string;
  regularSeasonEndDate?: string;
  postSeasonStartDate?: string;
  postSeasonEndDate?: string;
}

export async function fetchSeasonInfo(season: number): Promise<SeasonInfo | undefined> {
  try {
    const data = await apiGet<{ seasons?: SeasonInfo[] }>(`/seasons/${season}?sportId=1`, 60 * 60 * 1000);
    return data.seasons?.[0];
  } catch {
    return undefined; // next year's calendar may not be published yet
  }
}

export interface PitchingStat {
  wins?: number;
  losses?: number;
  era?: string;
  whip?: string;
  strikeOuts?: number;
  gamesStarted?: number;
  gamesPlayed?: number;
  inningsPitched?: string;
}

export interface ApiPerson {
  id: number;
  fullName: string;
  firstName?: string;
  lastName?: string;
  useName?: string;
  useLastName?: string;
  primaryNumber?: string;
  pitchHand?: { code: string };
  active?: boolean;
  primaryPosition?: { abbreviation: string };
  currentTeam?: { id: number; name: string; parentOrgId?: number };
  stats?: Array<{ type?: { displayName: string }; splits?: Array<{ stat: PitchingStat; team?: { id: number } } & GameLogSplit> }>;
}

export interface PeopleResponse {
  people?: ApiPerson[];
}

/**
 * Starters with their pitching line for `season` entering `date` (games
 * through the day before). One request for the whole slate.
 */
export function fetchPitcherLines(ids: number[], date: string, season: number): Promise<PeopleResponse> {
  if (ids.length === 0) return Promise.resolve({ people: [] });
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const through = addDays(date, -1);
  const stats =
    through >= `${season}-01-01`
      ? `&hydrate=stats(group=[pitching],type=[byDateRange],startDate=${season}-01-01,endDate=${through},season=${season})`
      : "";
  return apiGet<PeopleResponse>(`/people?personIds=${sorted.join(",")}${stats}`);
}

/** Current team plus the season's game log for several pitchers in one request. */
export function fetchPeopleWithGameLogs(ids: number[], season: number): Promise<PeopleResponse> {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  return apiGet<PeopleResponse>(
    `/people?personIds=${sorted.join(",")}&hydrate=currentTeam,stats(group=[pitching],type=[gameLog],season=${season})`
  );
}

export function gameLogOf(person: ApiPerson | undefined): GameLogSplit[] {
  const log = person?.stats?.find((s) => s.type?.displayName === "gameLog") ?? person?.stats?.[0];
  return (log?.splits ?? []) as GameLogSplit[];
}

/** The aggregate split (the one covering the most games, e.g. across a trade). */
export function seasonLineOf(person: ApiPerson | undefined): PitchingStat | undefined {
  const splits = person?.stats?.[0]?.splits ?? [];
  let best: PitchingStat | undefined;
  for (const s of splits) {
    if (!best || (s.stat.gamesPlayed ?? 0) > (best.gamesPlayed ?? 0)) best = s.stat;
  }
  return best;
}

export interface SearchHit {
  id: number;
  fullName: string;
  pitchHand: string;
  number?: string;
  teamId?: number;
  teamName?: string;
}

/** Active MLB pitchers (and two-way players) matching a name. */
export async function searchPitchers(query: string): Promise<SearchHit[]> {
  const data = await apiGet<PeopleResponse>(
    `/people/search?names=${encodeURIComponent(query)}&sportId=1&hydrate=currentTeam`
  );
  return (data.people ?? [])
    .filter((p) => p.active && ["P", "TWP"].includes(p.primaryPosition?.abbreviation ?? ""))
    .slice(0, 15)
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      pitchHand: p.pitchHand?.code ?? "R",
      number: p.primaryNumber,
      teamId: p.currentTeam?.parentOrgId ?? p.currentTeam?.id,
      teamName: p.currentTeam?.parentOrgId ? undefined : p.currentTeam?.name,
    }));
}
