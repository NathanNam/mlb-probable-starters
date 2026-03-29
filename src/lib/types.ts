// MLB API response types

export interface Team {
  id: number;
  name: string;
  teamName: string;
  abbreviation: string;
  league: { id: number; name: string };
  division: { id: number; name: string };
}

export interface Player {
  id: number;
  fullName: string;
  primaryPosition: { abbreviation: string };
  pitchHand?: { code: string; description: string };
  active: boolean;
  currentTeam?: Team;
}

export interface ScheduleGame {
  gamePk: number;
  gameDate: string; // ISO date
  officialDate: string; // YYYY-MM-DD
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
}

export interface GameLogSplit {
  date: string; // YYYY-MM-DD
  stat: {
    gamesStarted: number;
    gamesPlayed: number;
    inningsPitched: string;
    wins: number;
    losses: number;
    earnedRunAverage: string;
    strikeOuts: number;
  };
  team: { id: number; name: string };
  opponent: { id: number; name: string };
  isHome: boolean;
}

// App-level types

export interface SelectedPitcher {
  id: number;
  fullName: string;
  pitchHand: string; // "L" or "R"
  teamId: number;
  teamName: string;
}

export type MatchConfidence = "confirmed" | "projected" | "possible";

export interface PitcherWarning {
  type: "traded" | "inactive" | "no_starts";
  message: string;
}

export interface MatchedGame {
  gamePk: number;
  date: string; // YYYY-MM-DD
  gameDate: string; // ISO date
  opponent: string;
  venue: string;
  pitcher: SelectedPitcher;
  confidence: MatchConfidence;
  homePitcher?: { fullName: string }; // home team's probable starter
}
