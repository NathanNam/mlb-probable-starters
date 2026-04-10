const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

async function mlbFetch(path: string, revalidate = 3600): Promise<Response> {
  const res = await fetch(`${MLB_API_BASE}${path}`, { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`MLB API error: ${res.status} ${res.statusText} for ${path}`);
  }
  return res;
}

export async function fetchTeams() {
  const res = await mlbFetch("/teams?sportId=1");
  const data = await res.json();
  return data.teams as Array<{
    id: number;
    name: string;
    teamName: string;
    abbreviation: string;
    league: { id: number; name: string };
    division: { id: number; name: string };
  }>;
}

export async function searchPlayers(query: string) {
  const res = await mlbFetch(`/people/search?names=${encodeURIComponent(query)}&sportId=1`);
  const data = await res.json();
  const people = (data.people || []) as Array<{
    id: number;
    fullName: string;
    primaryPosition: { abbreviation: string };
    pitchHand?: { code: string };
    active: boolean;
    currentTeam?: { id: number; name: string };
  }>;
  // Filter to active pitchers (include two-way players like Ohtani)
  return people.filter(
    (p) => p.active && (p.primaryPosition.abbreviation === "P" || p.primaryPosition.abbreviation === "TWP")
  );
}

export async function fetchPlayer(playerId: number) {
  const res = await mlbFetch(`/people/${playerId}?hydrate=currentTeam`);
  const data = await res.json();
  return data.people?.[0] as {
    id: number;
    fullName: string;
    primaryPosition: { abbreviation: string };
    pitchHand?: { code: string; description: string };
    currentTeam?: { id: number; name: string };
  } | undefined;
}

export async function fetchSchedule(teamId: number, season: number) {
  const startDate = `${season}-03-01`;
  const endDate = `${season}-10-10`;
  const res = await mlbFetch(
    `/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R&hydrate=probablePitcher(note)&startDate=${startDate}&endDate=${endDate}`,
    300 // 5 min — probable pitchers update frequently
  );
  const data = await res.json();
  const games: Array<{
    gamePk: number;
    gameDate: string;
    officialDate: string;
    status: { detailedState: string };
    teams: {
      away: {
        team: { id: number; name: string };
        probablePitcher?: { id: number; fullName: string };
      };
      home: {
        team: { id: number; name: string };
        probablePitcher?: { id: number; fullName: string };
      };
    };
    venue: { name: string };
  }> = [];

  for (const date of data.dates || []) {
    for (const game of date.games || []) {
      games.push(game);
    }
  }
  return games;
}

export async function fetchGameLog(playerId: number, season: number) {
  const res = await mlbFetch(
    `/people/${playerId}/stats?stats=gameLog&group=pitching&season=${season}`,
    300 // 5 min — game logs update after each game
  );
  const data = await res.json();
  const splits =
    data.stats?.[0]?.splits ||
    ([] as Array<{
      date: string;
      stat: {
        gamesStarted: number;
        gamesPlayed: number;
        inningsPitched: string;
        strikeOuts: number;
        earnedRunAverage: string;
      };
      team: { id: number; name: string };
      opponent: { id: number; name: string };
      isHome: boolean;
    }>);
  return splits;
}
