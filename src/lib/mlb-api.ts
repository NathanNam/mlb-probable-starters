import type { GameLogSplit, ScheduleGame } from "./types";
import { getJson } from "./http";

const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";
/** Regular season plus every postseason round (wild card, division, LCS, World Series). */
export const GAME_TYPES = "R,F,D,L,W";

function mlbJson<T>(path: string, revalidate = 3600): Promise<T> {
  return getJson<T>(`${MLB_API_BASE}${path}`, { next: { revalidate } } as RequestInit);
}

export async function searchPlayers(query: string) {
  const data = await mlbJson<{ people?: Array<{
    id: number;
    fullName: string;
    primaryPosition: { abbreviation: string };
    pitchHand?: { code: string };
    active: boolean;
    currentTeam?: { id: number; name: string };
  }> }>(`/people/search?names=${encodeURIComponent(query)}&sportId=1`);
  // Active pitchers, including two-way players
  return (data.people || []).filter(
    (p) => p.active && (p.primaryPosition.abbreviation === "P" || p.primaryPosition.abbreviation === "TWP")
  );
}

export async function fetchPlayer(playerId: number) {
  const data = await mlbJson<{ people?: Array<{
    id: number;
    fullName: string;
    pitchHand?: { code: string; description: string };
    currentTeam?: { id: number; name: string };
  }> }>(`/people/${playerId}?hydrate=currentTeam`);
  return data.people?.[0];
}

/** A team's games for a whole season, regular season and postseason. */
export async function fetchSchedule(teamId: number, season: number): Promise<ScheduleGame[]> {
  const data = await mlbJson<{ dates?: Array<{ games: ScheduleGame[] }> }>(
    `/schedule?sportId=1&teamId=${teamId}&gameType=${GAME_TYPES}&hydrate=probablePitcher` +
      `&startDate=${season}-02-01&endDate=${season}-11-30`,
    300 // probable pitchers change often
  );
  return (data.dates || []).flatMap((d) => d.games || []);
}

export async function fetchGameLog(playerId: number, season: number): Promise<GameLogSplit[]> {
  const data = await mlbJson<{ stats?: Array<{ splits?: GameLogSplit[] }> }>(
    `/people/${playerId}/stats?stats=gameLog&group=pitching&season=${season}`,
    300
  );
  return data.stats?.[0]?.splits || [];
}
