import { describe, expect, it } from "vitest";
import schedule from "./fixtures/schedule-2026-08-15.json";
import people from "./fixtures/people-2026-08-15.json";
import ws from "./fixtures/schedule-ws.json";
import { assembleSlate, filterSlate, kPer9, probableIds, statusOf, toSlateGame } from "../src/lib/slate";
import { bannerFor } from "../src/lib/offseason";
import type { ScheduleResponse, PeopleResponse } from "../src/lib/statsapi";
import { game } from "./helpers";

const sched = schedule as unknown as ScheduleResponse;

describe("assembleSlate", () => {
  const slate = assembleSlate(sched, people as unknown as PeopleResponse);

  it("orders games by first pitch and fills both starters", () => {
    expect(slate.map((g) => `${g.away.team.abbr}@${g.home.team.abbr}`)).toEqual(["CWS@DET", "NYY@TOR", "MIL@LAD"]);
    const nyy = slate[1];
    expect(nyy.away.pitcher).toMatchObject({ lastName: "Schlittler", firstName: "Cam", number: "31", hand: "R" });
    expect(nyy.away.pitcher?.stats).toMatchObject({ wins: 10, losses: 6, era: "2.21", whip: "0.93", strikeOuts: 182, gamesStarted: 25 });
    expect(nyy.away.pitcher?.stats?.kPer9).toBe("11.2");
    expect(nyy.away.record).toBe("68-55");
  });

  it("reads scores and final status", () => {
    const det = slate[0];
    expect(det.status.kind).toBe("final");
    expect([det.away.score, det.home.score]).toEqual([4, 3]);
    expect(det.isPostseason).toBe(false);
  });

  it("still lists matchups when the stats request failed", () => {
    const bare = assembleSlate(sched, null);
    expect(bare).toHaveLength(3);
    expect(bare[0].away.pitcher?.fullName).toBe("Anthony Kay");
    expect(bare[0].away.pitcher?.stats).toBeUndefined();
  });

  it("collects starter ids once", () => {
    expect(probableIds(sched)).toHaveLength(6);
  });

  it("filters by club and by starter name, ignoring accents and case", () => {
    expect(filterSlate(slate, 141).map((g) => g.home.team.abbr)).toEqual(["TOR"]);
    expect(filterSlate(slate, undefined, "MISIO")).toHaveLength(1);
    expect(filterSlate(slate, 141, "misio")).toHaveLength(0);
  });
});

describe("postseason games", () => {
  it("carry the series label and standing", () => {
    const [g3] = assembleSlate(ws as unknown as ScheduleResponse);
    expect(g3.isPostseason).toBe(true);
    expect(g3.seriesLabel).toBe("World Series · Game 3");
    expect(g3.seriesNote).toMatch(/MIL leads 2-0/);
    expect(g3.away.team.abbr).toBe("MIL");
  });
});

describe("statusOf and doubleheaders", () => {
  it("maps postponed, suspended and live states", () => {
    expect(statusOf(game("2026-08-15", 1, 2, { status: "Postponed", abstract: "Final" })).kind).toBe("postponed");
    expect(statusOf(game("2026-08-15", 1, 2, { status: "Suspended: Rain", abstract: "Live" })).kind).toBe("suspended");
    expect(statusOf(game("2026-08-15", 1, 2, { status: "In Progress", abstract: "Live" })).kind).toBe("live");
    expect(statusOf(game("2026-08-15", 1, 2)).kind).toBe("scheduled");
  });
  it("marks doubleheader game numbers", () => {
    const g = toSlateGame(game("2026-08-15", 137, 119, { doubleHeader: "S", gameNumber: 2 }));
    expect(g.doubleHeader).toBe(true);
    expect(g.gameNumber).toBe(2);
  });
  it("computes K/9 from thirds of an inning", () => {
    expect(kPer9(182, "146.2")).toBe("11.2");
    expect(kPer9(0, "0.0")).toBeUndefined();
  });
});

describe("days without games", () => {
  const wsGames = (ws as unknown as ScheduleResponse).dates!.flatMap((d) => d.games);

  it("points a postseason travel day at the next game", () => {
    const b = bannerFor("2026-10-25", true, wsGames, undefined, undefined, "America/Los_Angeles");
    expect(b.tag).toBe("Postseason");
    expect(b.title).toBe("No games today.");
    expect(b.detail).toContain("World Series · Game 3 — Mon, Oct 26, 5:00 PM PDT");
    expect(b.detail).toContain("Robert Gasser (MIL) vs Freddy Peralta (TB)");
    expect(b.action?.date).toBe("2026-10-26");
  });

  it("sends the winter to Opening Day", () => {
    const b = bannerFor(
      "2026-12-01",
      false,
      [],
      { seasonId: "2026", regularSeasonStartDate: "2026-03-25" },
      { seasonId: "2027", springStartDate: "2027-02-19", regularSeasonStartDate: "2027-03-25" }
    );
    expect(b.tag).toBe("Off-season");
    expect(b.title).toContain("back in spring");
    expect(b.detail).toContain("Opening Day is Thu, Mar 25, 2027");
    expect(b.action?.date).toBe("2027-03-25");
  });

  it("names a regular-season off day's next slate", () => {
    const b = bannerFor("2026-07-13", false, [game("2026-07-16", 1, 2), game("2026-07-16", 3, 4)], undefined, undefined);
    expect(b.tag).toBe("Off day");
    expect(b.detail).toBe("Next up: 2 games on Thu, Jul 16.");
  });
});
