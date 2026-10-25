import { describe, expect, it } from "vitest";
import {
  buildRotationInfo,
  calculateRotationGap,
  groupIntoSeries,
  inactivityWarning,
  isPlayable,
  projectPitcherStarts,
  projectedRotationDates,
  startsFromGameLog,
  upcomingGames,
} from "../src/lib/projection";
import type { SelectedPitcher } from "../src/lib/types";
import { game, start } from "./helpers";

const HOME = 137; // SF
const OPP = 119; // LAD
const pitcher: SelectedPitcher = { id: 42, fullName: "Ace Pitcher", pitchHand: "L", teamId: OPP, teamName: "Team 119" };

describe("calculateRotationGap", () => {
  it("averages normal gaps and ignores IL-length or tiny gaps", () => {
    const starts = ["2026-04-01", "2026-04-06", "2026-04-12", "2026-05-10", "2026-05-15"].map((date) => ({ date }));
    expect(calculateRotationGap(starts)).toBe(5); // 5, 6, 5 kept; 28 dropped
  });
  it("defaults to 5 with too little data", () => {
    expect(calculateRotationGap([{ date: "2026-04-01" }])).toBe(5);
  });
});

describe("groupIntoSeries", () => {
  it("splits visits by gaps of more than three days and keeps a doubleheader in one series", () => {
    const games = [
      game("2026-05-01", OPP, HOME),
      game("2026-05-02", OPP, HOME, { gameNumber: 1, doubleHeader: "Y" }),
      game("2026-05-02", OPP, HOME, { gameNumber: 2, doubleHeader: "Y" }),
      game("2026-05-03", OPP, HOME),
      game("2026-07-10", OPP, HOME),
      game("2026-07-11", OPP, HOME),
      game("2026-07-12", 120, HOME), // other opponent
    ];
    const series = groupIntoSeries(games, OPP);
    expect(series).toHaveLength(2);
    expect(series[0].games.map((g) => `${g.officialDate}#${g.gameNumber}`)).toEqual([
      "2026-05-01#1",
      "2026-05-02#1",
      "2026-05-02#2",
      "2026-05-03#1",
    ]);
    expect(series[1].games).toHaveLength(2);
  });
});

describe("upcomingGames / isPlayable", () => {
  it("drops past, final, postponed and suspended games", () => {
    const games = [
      game("2026-08-10", OPP, HOME, { status: "Final" }),
      game("2026-08-20", OPP, HOME, { status: "Postponed", abstract: "Final" }),
      game("2026-08-21", OPP, HOME, { status: "Suspended: Rain", abstract: "Live" }),
      game("2026-08-14", OPP, HOME), // before today
      game("2026-08-22", OPP, HOME),
    ];
    expect(isPlayable(games[0])).toBe(false);
    expect(upcomingGames(games, "2026-08-15").map((g) => g.officialDate)).toEqual(["2026-08-22"]);
  });
});

describe("projectPitcherStarts", () => {
  const log = ["2026-07-28", "2026-08-02", "2026-08-07", "2026-08-12"].map((d) => start(d));

  it("picks the series game nearest the rotation as projected", () => {
    // Next starts project to Aug 17, Aug 22.
    const games = [game("2026-08-16", OPP, HOME), game("2026-08-17", OPP, HOME), game("2026-08-18", OPP, HOME)];
    const out = projectPitcherStarts(games, pitcher, log, "2026-08-15");
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-08-17");
    expect(out[0].confidence).toBe("projected");
  });

  it("marks a series as possible when the rotation misses it by more than a day", () => {
    const games = [game("2026-08-19", OPP, HOME), game("2026-08-20", OPP, HOME)];
    const out = projectPitcherStarts(games, pitcher, log, "2026-08-15");
    expect(out[0].confidence).toBe("possible");
  });

  it("uses MLB's announced starter and skips games already given to someone else", () => {
    const games = [
      game("2026-08-16", OPP, HOME, { awayProbable: 7 }),
      game("2026-08-17", OPP, HOME, { awayProbable: 42 }),
      game("2026-08-18", OPP, HOME),
    ];
    const out = projectPitcherStarts(games, pitcher, log, "2026-08-15");
    expect(out).toEqual([expect.objectContaining({ date: "2026-08-17", confidence: "confirmed" })]);
  });

  it("ignores games already played or postponed", () => {
    const games = [
      game("2026-08-12", OPP, HOME, { status: "Final" }),
      game("2026-08-17", OPP, HOME, { status: "Postponed", abstract: "Final" }),
    ];
    expect(projectPitcherStarts(games, pitcher, log, "2026-08-15")).toEqual([]);
  });

  it("returns nothing in the off-season when the home schedule is over", () => {
    const games = [game("2026-09-20", OPP, HOME, { status: "Final" })];
    expect(projectPitcherStarts(games, pitcher, log, "2026-10-25")).toEqual([]);
  });

  it("only says 'possible' for next season's games — a rotation doesn't carry over the winter", () => {
    const sept = ["2026-09-15", "2026-09-20", "2026-09-25"].map((d) => start(d));
    const games = [game("2027-04-10", OPP, HOME), game("2027-04-11", OPP, HOME)];
    const out = projectPitcherStarts(games, pitcher, sept, "2026-10-25");
    expect(out.map((g) => g.confidence)).toEqual(["possible"]);
  });
});

describe("projectedRotationDates", () => {
  it("rolls forward from the last start and stops at the end of that season", () => {
    expect(projectedRotationDates("2026-09-20", 5, "2026-09-26", "2027-05-01")).toEqual([
      "2026-09-30",
      "2026-10-05",
      "2026-10-10",
      "2026-10-15",
      "2026-10-20",
      "2026-10-25",
      "2026-10-30",
      "2026-11-04",
      "2026-11-09",
      "2026-11-14",
      "2026-11-19",
      "2026-11-24",
      "2026-11-29",
    ]);
  });
  it("gives up when the last start is stale", () => {
    expect(projectedRotationDates("2026-06-01", 5, "2026-08-15", "2026-09-30")).toEqual([]);
  });
});

describe("buildRotationInfo", () => {
  it("finds a confirmed next start on the pitcher's own schedule", () => {
    const log = ["2026-08-02", "2026-08-07", "2026-08-12"].map((d) => start(d));
    const schedule = [game("2026-08-16", 120, OPP), game("2026-08-17", 120, OPP, { homeProbable: 42 })];
    const info = buildRotationInfo(pitcher, log, "2026-08-15", schedule);
    expect(info.nextProjectedStart).toBe("2026-08-17");
    expect(info.nextProjectedConfidence).toBe("confirmed");
    expect(info.nextProjectedIsHome).toBe(true);
  });

  it("has no next start once the team's season is over", () => {
    const log = ["2026-09-15", "2026-09-20", "2026-09-25"].map((d) => start(d));
    const schedule = [game("2026-09-27", 120, OPP, { status: "Final" })];
    const info = buildRotationInfo(pitcher, log, "2026-10-25", schedule);
    expect(info.nextProjectedStart).toBe("");
    expect(info.starts).toHaveLength(3);
  });

  it("dedupes repeated log rows", () => {
    expect(startsFromGameLog([start("2026-08-01"), start("2026-08-01")])).toHaveLength(1);
  });
});

describe("inactivityWarning", () => {
  const season = [game("2026-03-26", OPP, HOME), game("2026-09-27", OPP, HOME)];

  it("warns mid-season when the last start is over two weeks old", () => {
    const w = inactivityWarning(startsFromGameLog([start("2026-07-01")]), season, "2026-08-15");
    expect(w?.type).toBe("inactive");
  });

  it("never warns in the off-season or the postseason", () => {
    expect(inactivityWarning(startsFromGameLog([start("2026-07-01")]), season, "2026-10-25")).toBeNull();
    expect(inactivityWarning([], season, "2026-01-15")).toBeNull();
  });

  it("flags no starts three weeks into the season", () => {
    expect(inactivityWarning([], season, "2026-04-20")?.type).toBe("no_starts");
    expect(inactivityWarning([], season, "2026-04-05")).toBeNull();
  });
});
