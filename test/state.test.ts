import { describe, expect, it, vi } from "vitest";
import { parseView, viewToSearch } from "../src/lib/urlState";
import { parseSaved } from "../src/lib/storage";
import { cached } from "../src/lib/cache";

describe("URL state", () => {
  it("round-trips date, tab and team and ignores junk", () => {
    expect(parseView("?date=2026-08-15&tab=rotation&team=sf")).toEqual({ date: "2026-08-15", tab: "rotation", team: "SF" });
    expect(parseView("?date=nope&tab=bogus")).toEqual({ date: undefined, tab: "slate", team: undefined });
    expect(viewToSearch({ date: "2026-08-15", tab: "slate", team: "LAD" })).toBe("?date=2026-08-15&team=LAD");
    expect(viewToSearch({ tab: "slate" })).toBe("");
  });
});

describe("saved selections", () => {
  it("reads the old {team, pitchers} shape and survives garbage", () => {
    expect(parseSaved(JSON.stringify({ team: { id: 137 }, pitchers: [{ id: 1, teamId: 119 }, { id: "x" }] }))).toEqual({
      teamId: 137,
      pitchers: [{ id: 1, teamId: 119 }],
    });
    expect(parseSaved("{not json")).toEqual({ teamId: null, pitchers: [] });
  });
});

describe("request cache", () => {
  it("shares a request within the TTL and refetches after it", async () => {
    const load = vi.fn(async () => 1);
    await cached("k1", 1000, load, 0);
    await cached("k1", 1000, load, 500);
    expect(load).toHaveBeenCalledTimes(1);
    await cached("k1", 1000, load, 1500);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("does not keep failures", async () => {
    const fail = vi.fn(async () => {
      throw new Error("down");
    });
    await expect(cached("k2", 1000, fail, 0)).rejects.toThrow();
    await expect(cached("k2", 1000, fail, 1)).rejects.toThrow();
    expect(fail).toHaveBeenCalledTimes(2);
  });
});
