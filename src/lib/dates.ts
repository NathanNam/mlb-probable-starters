// Date helpers. Calendar dates are plain "YYYY-MM-DD" strings; arithmetic is
// done at UTC noon so DST changes never shift a day. "Today" is always taken in
// a real time zone (the viewer's, or New York for MLB's schedule day), never UTC.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MLB_TIME_ZONE = "America/New_York";

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidYmd(value: string | null | undefined): value is string {
  if (!value) return false;
  const m = YMD_RE.exec(value);
  if (!m) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Calendar date of `instant` in `timeZone` (viewer's zone when omitted). */
export function ymdInZone(instant: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today in the viewer's time zone. */
export function todayLocal(now: Date = new Date(), timeZone?: string): string {
  return ymdInZone(now, timeZone);
}

/** Today on MLB's schedule calendar (Eastern time). */
export function todayET(now: Date = new Date()): string {
  return ymdInZone(now, MLB_TIME_ZONE);
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T12:00:00Z`).getTime();
  const db = new Date(`${b}T12:00:00Z`).getTime();
  return Math.round((db - da) / MS_PER_DAY);
}

/** MLB seasons run within one calendar year, so the season is the date's year. */
export function seasonFromDate(ymd: string): number {
  return Number(ymd.slice(0, 4));
}

/**
 * The season whose schedule matters for looking ahead from `ymd`. Once the
 * postseason is long over (mid-November on), that is next year's season.
 */
export function upcomingSeason(ymd: string): number {
  const season = seasonFromDate(ymd);
  return ymd.slice(5) > "11-10" ? season + 1 : season;
}

export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Game start in the given zone (viewer's by default): { time: "7:05 PM", zone: "PDT" }. */
export function formatGameTime(iso: string, timeZone?: string): { time: string; zone: string } {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  const zone =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  return { time, zone };
}

/** Format a calendar date (no time zone shifting). */
export function formatYmd(ymd: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}
