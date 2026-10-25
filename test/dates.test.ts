import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatGameTime,
  isValidYmd,
  seasonFromDate,
  todayET,
  todayLocal,
  upcomingSeason,
  ymdInZone,
} from "../src/lib/dates";

describe("season from date", () => {
  it("is the calendar year", () => {
    expect(seasonFromDate("2026-08-15")).toBe(2026);
    expect(seasonFromDate("2027-02-20")).toBe(2027);
  });
  it("looks ahead to next season only once the postseason is long over", () => {
    expect(upcomingSeason("2026-10-25")).toBe(2026);
    expect(upcomingSeason("2026-11-10")).toBe(2026);
    expect(upcomingSeason("2026-11-11")).toBe(2027);
    expect(upcomingSeason("2027-01-05")).toBe(2027);
  });
});

describe("today in a real time zone", () => {
  // 03:30 UTC on Oct 26 is still Oct 25 on both US coasts.
  const instant = new Date("2026-10-26T03:30:00Z");
  it("uses the viewer's zone, not UTC", () => {
    expect(todayLocal(instant, "America/Los_Angeles")).toBe("2026-10-25");
    expect(todayLocal(instant, "Asia/Tokyo")).toBe("2026-10-26");
    expect(ymdInZone(instant, "UTC")).toBe("2026-10-26");
  });
  it("uses Eastern time for MLB's schedule day", () => {
    expect(todayET(instant)).toBe("2026-10-25");
  });
});

describe("formatGameTime", () => {
  const first = "2026-10-27T00:00:00Z"; // World Series Game 3 first pitch
  it("shows the start in the viewer's zone with its abbreviation", () => {
    expect(formatGameTime(first, "America/Los_Angeles")).toEqual({ time: "5:00 PM", zone: "PDT" });
    expect(formatGameTime(first, "America/New_York")).toEqual({ time: "8:00 PM", zone: "EDT" });
    expect(formatGameTime("2026-08-15T17:10:00Z", "America/Chicago")).toEqual({ time: "12:10 PM", zone: "CDT" });
  });
  it("follows daylight-saving changes", () => {
    expect(formatGameTime("2026-11-03T00:00:00Z", "America/Los_Angeles").zone).toBe("PST");
  });
});

describe("calendar arithmetic", () => {
  it("adds days across DST and month ends", () => {
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(daysBetween("2026-02-27", "2026-03-02")).toBe(3);
  });
  it("validates YYYY-MM-DD", () => {
    expect(isValidYmd("2026-08-15")).toBe(true);
    expect(isValidYmd("2026-02-30")).toBe(false);
    expect(isValidYmd("8/15/2026")).toBe(false);
    expect(isValidYmd(null)).toBe(false);
  });
});
