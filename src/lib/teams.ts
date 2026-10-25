// The 30 clubs, kept locally so no request is needed to draw a card.
// Colours are plain hex pairs used for the halftone team bands (no logos).

export interface Team {
  id: number;
  abbr: string;
  name: string; // "San Francisco Giants"
  club: string; // "Giants"
  league: "AL" | "NL";
  division: "East" | "Central" | "West";
  colors: [string, string];
}

export const TEAMS: Team[] = [
  { id: 110, abbr: "BAL", name: "Baltimore Orioles", club: "Orioles", league: "AL", division: "East", colors: ["#DF4601", "#000000"] },
  { id: 111, abbr: "BOS", name: "Boston Red Sox", club: "Red Sox", league: "AL", division: "East", colors: ["#BD3039", "#0C2340"] },
  { id: 147, abbr: "NYY", name: "New York Yankees", club: "Yankees", league: "AL", division: "East", colors: ["#0C2340", "#C4CED4"] },
  { id: 139, abbr: "TB", name: "Tampa Bay Rays", club: "Rays", league: "AL", division: "East", colors: ["#092C5C", "#8FBCE6"] },
  { id: 141, abbr: "TOR", name: "Toronto Blue Jays", club: "Blue Jays", league: "AL", division: "East", colors: ["#134A8E", "#1D2D5C"] },
  { id: 145, abbr: "CWS", name: "Chicago White Sox", club: "White Sox", league: "AL", division: "Central", colors: ["#27251F", "#C4CED4"] },
  { id: 114, abbr: "CLE", name: "Cleveland Guardians", club: "Guardians", league: "AL", division: "Central", colors: ["#00385D", "#E50022"] },
  { id: 116, abbr: "DET", name: "Detroit Tigers", club: "Tigers", league: "AL", division: "Central", colors: ["#0C2340", "#FA4616"] },
  { id: 118, abbr: "KC", name: "Kansas City Royals", club: "Royals", league: "AL", division: "Central", colors: ["#004687", "#BD9B60"] },
  { id: 142, abbr: "MIN", name: "Minnesota Twins", club: "Twins", league: "AL", division: "Central", colors: ["#002B5C", "#D31145"] },
  { id: 133, abbr: "ATH", name: "Athletics", club: "Athletics", league: "AL", division: "West", colors: ["#003831", "#EFB21E"] },
  { id: 117, abbr: "HOU", name: "Houston Astros", club: "Astros", league: "AL", division: "West", colors: ["#002D62", "#EB6E1F"] },
  { id: 108, abbr: "LAA", name: "Los Angeles Angels", club: "Angels", league: "AL", division: "West", colors: ["#BA0021", "#003263"] },
  { id: 136, abbr: "SEA", name: "Seattle Mariners", club: "Mariners", league: "AL", division: "West", colors: ["#0C2C56", "#005C5C"] },
  { id: 140, abbr: "TEX", name: "Texas Rangers", club: "Rangers", league: "AL", division: "West", colors: ["#003278", "#C0111F"] },
  { id: 144, abbr: "ATL", name: "Atlanta Braves", club: "Braves", league: "NL", division: "East", colors: ["#CE1141", "#13274F"] },
  { id: 146, abbr: "MIA", name: "Miami Marlins", club: "Marlins", league: "NL", division: "East", colors: ["#0077A8", "#EF3340"] },
  { id: 121, abbr: "NYM", name: "New York Mets", club: "Mets", league: "NL", division: "East", colors: ["#002D72", "#FF5910"] },
  { id: 143, abbr: "PHI", name: "Philadelphia Phillies", club: "Phillies", league: "NL", division: "East", colors: ["#E81828", "#002D72"] },
  { id: 120, abbr: "WSH", name: "Washington Nationals", club: "Nationals", league: "NL", division: "East", colors: ["#AB0003", "#14225A"] },
  { id: 112, abbr: "CHC", name: "Chicago Cubs", club: "Cubs", league: "NL", division: "Central", colors: ["#0E3386", "#CC3433"] },
  { id: 113, abbr: "CIN", name: "Cincinnati Reds", club: "Reds", league: "NL", division: "Central", colors: ["#C6011F", "#000000"] },
  { id: 158, abbr: "MIL", name: "Milwaukee Brewers", club: "Brewers", league: "NL", division: "Central", colors: ["#12284B", "#FFC52F"] },
  { id: 134, abbr: "PIT", name: "Pittsburgh Pirates", club: "Pirates", league: "NL", division: "Central", colors: ["#27251F", "#FDB827"] },
  { id: 138, abbr: "STL", name: "St. Louis Cardinals", club: "Cardinals", league: "NL", division: "Central", colors: ["#C41E3A", "#0C2340"] },
  { id: 109, abbr: "AZ", name: "Arizona Diamondbacks", club: "D-backs", league: "NL", division: "West", colors: ["#A71930", "#E3D4AD"] },
  { id: 115, abbr: "COL", name: "Colorado Rockies", club: "Rockies", league: "NL", division: "West", colors: ["#33006F", "#C4CED4"] },
  { id: 119, abbr: "LAD", name: "Los Angeles Dodgers", club: "Dodgers", league: "NL", division: "West", colors: ["#005A9C", "#EF3E42"] },
  { id: 135, abbr: "SD", name: "San Diego Padres", club: "Padres", league: "NL", division: "West", colors: ["#2F241D", "#FFC425"] },
  { id: 137, abbr: "SF", name: "San Francisco Giants", club: "Giants", league: "NL", division: "West", colors: ["#FD5A1E", "#27251F"] },
];

const BY_ID = new Map(TEAMS.map((t) => [t.id, t]));
const BY_ABBR = new Map(TEAMS.map((t) => [t.abbr, t]));

export function teamById(id: number | undefined): Team | undefined {
  return id === undefined ? undefined : BY_ID.get(id);
}

export function teamByAbbr(abbr: string | null | undefined): Team | undefined {
  return abbr ? BY_ABBR.get(abbr.toUpperCase()) : undefined;
}

/** A team for any id/name pair, falling back to a neutral card for unknown clubs (e.g. All-Star squads). */
export function teamOrFallback(id: number, name: string): Team {
  return (
    BY_ID.get(id) ?? {
      id,
      abbr: name.replace(/[^A-Z]/g, "").slice(0, 3) || "MLB",
      name,
      club: name,
      league: "AL",
      division: "East",
      colors: ["#4a4038", "#9a8c78"],
    }
  );
}

export const DIVISIONS: Array<{ label: string; league: Team["league"]; division: Team["division"] }> = [
  { label: "AL East", league: "AL", division: "East" },
  { label: "AL Central", league: "AL", division: "Central" },
  { label: "AL West", league: "AL", division: "West" },
  { label: "NL East", league: "NL", division: "East" },
  { label: "NL Central", league: "NL", division: "Central" },
  { label: "NL West", league: "NL", division: "West" },
];

/** Colours that tell tracked pitchers apart (always paired with the name in the UI). */
export const PITCHER_COLORS = ["#1f3550", "#b83a2b", "#3d6b45", "#6a3d7a", "#a8641c", "#1d6a7a", "#8a2f55", "#3d4a8a"];

export function pitcherColor(index: number): string {
  return PITCHER_COLORS[((index % PITCHER_COLORS.length) + PITCHER_COLORS.length) % PITCHER_COLORS.length];
}
