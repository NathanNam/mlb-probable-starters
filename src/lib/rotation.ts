// Rotation watch: which upcoming home games might your chosen opposing starters pitch?

import type { MatchedGame, PitcherWarning, RotationInfo, ScheduleGame, SelectedPitcher } from "./types";
import { buildRotationInfo, inactivityWarning, projectPitcherStarts, startsFromGameLog, upcomingGames } from "./projection";
import { fetchPeopleWithGameLogs, fetchTeamSeason, gameLogOf, type ApiPerson } from "./statsapi";
import { upcomingSeason } from "./dates";
import { teamById, type Team } from "./teams";

export interface RotationResult {
  /** The tracked pitchers, with teams updated after trades (same order as given). */
  pitchers: SelectedPitcher[];
  rotations: RotationInfo[];
  matches: MatchedGame[];
  warnings: Map<number, PitcherWarning>;
  /** Season the home games come from (next season once this one is over for the home club). */
  homeSeason: number;
  /** True when the home club has nothing left this season. */
  homeSeasonOver: boolean;
}

function mlbTeamId(person: ApiPerson | undefined): number | undefined {
  const t = person?.currentTeam;
  if (!t) return undefined;
  const id = t.parentOrgId ?? t.id;
  return teamById(id) ? id : undefined;
}

export async function runRotationWatch(home: Team, tracked: SelectedPitcher[], today: string): Promise<RotationResult> {
  const season = upcomingSeason(today);
  const ids = tracked.map((p) => p.id);

  const people = await fetchPeopleWithGameLogs(ids, season);
  const byId = new Map((people.people ?? []).map((p) => [p.id, p]));

  // Pitchers short on starts this season borrow last season's log (one request for all of them).
  const needLastYear = ids.filter((id) => startsFromGameLog(gameLogOf(byId.get(id))).length < 3);
  const lastYear = needLastYear.length
    ? new Map(((await fetchPeopleWithGameLogs(needLastYear, season - 1)).people ?? []).map((p) => [p.id, p]))
    : new Map<number, ApiPerson>();

  const warnings = new Map<number, PitcherWarning>();
  const pitchers = tracked.map((p) => {
    const person = byId.get(p.id);
    const teamId = mlbTeamId(person);
    if (teamId && teamId !== p.teamId) {
      const team = teamById(teamId)!;
      warnings.set(p.id, { type: "traded", message: `Now with the ${team.name} (was ${p.teamName})` });
      return { ...p, teamId, teamName: team.name };
    }
    if (person && !person.currentTeam) {
      warnings.set(p.id, { type: "inactive", message: "No longer on an active roster" });
    }
    return p;
  });

  // One schedule per club, shared by every pitcher on it.
  const teamIds = [...new Set([home.id, ...pitchers.map((p) => p.teamId)])];
  const schedules = new Map<number, ScheduleGame[]>(
    await Promise.all(teamIds.map(async (id) => [id, await fetchTeamSeason(id, season)] as const))
  );

  let homeSeason = season;
  let homeGames = (schedules.get(home.id) ?? []).filter((g) => g.teams.home.team.id === home.id);
  const homeSeasonOver = upcomingGames(homeGames, today).length === 0;
  if (homeSeasonOver) {
    homeSeason = season + 1;
    homeGames = (await fetchTeamSeason(home.id, homeSeason)).filter((g) => g.teams.home.team.id === home.id);
  }

  const rotations: RotationInfo[] = [];
  const matches: MatchedGame[] = [];
  for (const pitcher of pitchers) {
    const splits = [...gameLogOf(lastYear.get(pitcher.id)), ...gameLogOf(byId.get(pitcher.id))];
    const teamSchedule = schedules.get(pitcher.teamId) ?? [];
    const warning = inactivityWarning(startsFromGameLog(splits), teamSchedule, today);
    if (warning && !warnings.has(pitcher.id)) warnings.set(pitcher.id, warning);
    rotations.push(buildRotationInfo(pitcher, splits, today, teamSchedule));
    matches.push(...projectPitcherStarts(homeGames, pitcher, splits, today));
  }
  matches.sort((a, b) => a.date.localeCompare(b.date) || (a.gameNumber ?? 1) - (b.gameNumber ?? 1));

  return { pitchers, rotations, matches, warnings, homeSeason, homeSeasonOver };
}
