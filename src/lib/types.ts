// Shapes of the MLB Stats API responses we use (trimmed to the fields we read).

export interface ApiTeamSide {
  team: { id: number; name: string };
  probablePitcher?: { id: number; fullName: string };
  leagueRecord?: { wins: number; losses: number };
  score?: number;
  isWinner?: boolean;
}

export interface ScheduleGame {
  gamePk: number;
  gameType?: string; // R regular, F wild card, D division, L LCS, W World Series
  gameDate: string; // ISO instant
  officialDate: string; // YYYY-MM-DD (MLB's schedule day)
  status: {
    detailedState: string;
    abstractGameState?: string; // Preview | Live | Final
    codedGameState?: string;
    startTimeTBD?: boolean;
    reason?: string;
  };
  teams: { away: ApiTeamSide; home: ApiTeamSide };
  venue: { id?: number; name: string };
  doubleHeader?: string; // N | Y (traditional) | S (split)
  gameNumber?: number;
  description?: string;
  seriesDescription?: string;
  seriesGameNumber?: number;
  gamesInSeries?: number;
  ifNecessary?: string;
  seriesStatus?: { result?: string; shortDescription?: string; description?: string };
}

export interface GameLogSplit {
  date: string; // YYYY-MM-DD
  gameType?: string;
  stat: {
    gamesStarted?: number;
    gamesPlayed?: number;
    inningsPitched?: string;
    strikeOuts?: number;
  };
  team?: { id: number; name: string };
  opponent?: { id: number; name: string };
  isHome?: boolean;
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
  gameDate: string; // ISO instant
  opponent: string;
  opponentId: number;
  venue: string;
  pitcher: SelectedPitcher;
  confidence: MatchConfidence;
  gameNumber?: number;
  doubleHeader?: string;
  homePitcher?: { fullName: string }; // home team's probable starter
}

export interface RotationStart {
  date: string; // YYYY-MM-DD
  opponent: string;
  opponentId?: number;
  isHome: boolean;
}

export interface RotationInfo {
  pitcherId: number;
  pitcherName: string;
  pitchHand: string;
  teamName: string;
  teamId: number;
  starts: RotationStart[];
  avgGap: number;
  nextProjectedStart: string; // YYYY-MM-DD, "" when nothing is left on the schedule
  nextProjectedOpponent?: string; // full team name
  nextProjectedIsHome?: boolean;
  nextProjectedConfidence?: MatchConfidence;
  totalStarts: number;
}
