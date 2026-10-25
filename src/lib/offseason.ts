// What to say on a day without games: an off day, a postseason travel day,
// or the winter — and where the next game is.

import type { SeasonInfo } from "./statsapi";
import { fetchScheduleRange, fetchSeasonInfo } from "./statsapi";
import { addDays, formatGameTime, formatYmd, seasonFromDate } from "./dates";
import { toSlateGame, type SlateGame } from "./slate";
import type { ScheduleGame } from "./types";

export interface BannerInfo {
  tag: string;
  title: string;
  detail?: string;
  note?: string;
  action?: { label: string; date: string };
}

const LOOKAHEAD_DAYS = 10;

function dayLabel(ymd: string) {
  return formatYmd(ymd, { weekday: "short", month: "short", day: "numeric" });
}

function longDay(ymd: string) {
  return formatYmd(ymd, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function starter(side: SlateGame["away"]) {
  return side.pitcher ? `${side.pitcher.fullName} (${side.team.abbr})` : `${side.team.abbr} starter TBD`;
}

/** Pure: build the banner from the next games found and the season calendars. */
export function bannerFor(
  date: string,
  isToday: boolean,
  nextGames: ScheduleGame[],
  season: SeasonInfo | undefined,
  nextSeason: SeasonInfo | undefined,
  timeZone?: string
): BannerInfo {
  const none = isToday ? "No games today." : `No games on ${dayLabel(date)}.`;
  const sorted = [...nextGames].sort((a, b) => a.gameDate.localeCompare(b.gameDate));
  if (sorted.length > 0) {
    const first = toSlateGame(sorted[0]);
    const sameDay = sorted.filter((g) => g.officialDate === first.officialDate);
    if (first.isPostseason) {
      const when = first.startTimeTBD
        ? dayLabel(first.officialDate)
        : (() => {
            const { time, zone } = formatGameTime(first.gameDate, timeZone);
            return `${dayLabel(first.officialDate)}, ${time} ${zone}`;
          })();
      const label = first.seriesLabel ?? "Postseason";
      return {
        tag: "Postseason",
        title: none,
        detail: `${label} — ${when}: ${starter(first.away)} vs ${starter(first.home)}`,
        note: [first.seriesNote, first.venue].filter(Boolean).join(" · "),
        action: { label: `View ${label.split(" · ")[0]} card`, date: first.officialDate },
      };
    }
    return {
      tag: "Off day",
      title: none,
      detail: `Next up: ${sameDay.length} game${sameDay.length === 1 ? "" : "s"} on ${dayLabel(first.officialDate)}.`,
      action: { label: `Go to ${formatYmd(first.officialDate, { month: "short", day: "numeric" })}`, date: first.officialDate },
    };
  }

  const year = seasonFromDate(date);
  const before = season?.regularSeasonStartDate && date < season.regularSeasonStartDate;
  const target = before ? season : nextSeason;
  const opening = target?.regularSeasonStartDate;
  const spring = target?.springStartDate;
  const parts: string[] = [];
  if (spring && spring > date) parts.push(`Spring training opens ${longDay(spring)}`);
  if (opening) parts.push(`Opening Day is ${longDay(opening)}`);
  return {
    tag: before ? "Preseason" : "Off-season",
    title: before ? `${none} The ${year} season hasn't started yet.` : `${none} The ${year} season is over — back in spring.`,
    detail: parts.length ? `${parts.join("; ")}.` : `The ${before ? year : year + 1} schedule isn't out yet.`,
    action: opening ? { label: "See Opening Day", date: opening } : undefined,
  };
}

export async function loadBanner(date: string, isToday: boolean): Promise<BannerInfo> {
  const nextGames = await fetchScheduleRange(addDays(date, 1), addDays(date, LOOKAHEAD_DAYS));
  if (nextGames.length > 0) return bannerFor(date, isToday, nextGames, undefined, undefined);
  const year = seasonFromDate(date);
  const [season, nextSeason] = await Promise.all([fetchSeasonInfo(year), fetchSeasonInfo(year + 1)]);
  return bannerFor(date, isToday, [], season, nextSeason);
}
