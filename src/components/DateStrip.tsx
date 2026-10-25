"use client";

import { useLayoutEffect, useRef } from "react";
import { addDays, formatYmd } from "@/lib/dates";

interface DateStripProps {
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}

/** Ticket-stub date picker: a week around the selected day, week jumps and Today. */
export default function DateStrip({ selected, today, onSelect }: DateStripProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(selected, i - 3));

  // Keep the selected stub in view on narrow screens without scrolling the page.
  useLayoutEffect(() => {
    const box = scroller.current;
    const on = box?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (box && on) box.scrollLeft = on.offsetLeft - box.clientWidth / 2 + on.offsetWidth / 2;
  }, [selected]);

  return (
    <div className="datestrip" role="group" aria-label="Choose a date">
      <button type="button" className="stub arrow" aria-label="Back one week" onClick={() => onSelect(addDays(selected, -7))}>
        ‹
      </button>
      <div className="dates" ref={scroller}>
        {days.map((d) => (
          <button
            key={d}
            type="button"
            className={`stub${d === selected ? " on" : ""}${d === today ? " is-today" : ""}`}
            aria-pressed={d === selected}
            aria-label={formatYmd(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) + (d === today ? " (today)" : "")}
            onClick={() => onSelect(d)}
          >
            <span>{formatYmd(d, { weekday: "short" })}</span>
            <b>{Number(d.slice(8))}</b>
            <span>{formatYmd(d, { month: "short" })}</span>
          </button>
        ))}
      </div>
      <button type="button" className="stub arrow" aria-label="Forward one week" onClick={() => onSelect(addDays(selected, 7))}>
        ›
      </button>
      <button
        type="button"
        className="stub today"
        aria-label={`Today, ${formatYmd(today, { weekday: "long", month: "long", day: "numeric" })}`}
        aria-pressed={selected === today}
        onClick={() => onSelect(today)}
      >
        <span>Today</span>
        <b>{Number(today.slice(8))}</b>
        <span>{formatYmd(today, { month: "short" })}</span>
      </button>
    </div>
  );
}
