"use client";

import { useEffect, useRef, useState } from "react";
import { searchPitchers, type SearchHit } from "@/lib/statsapi";
import { teamById } from "@/lib/teams";
import type { SelectedPitcher } from "@/lib/types";

interface PitcherSearchProps {
  selected: SelectedPitcher[];
  onAdd: (pitcher: SelectedPitcher) => void;
}

/** Name search against MLB's player index; adds active pitchers to the watch list. */
export default function PitcherSearch({ selected, onAdd }: PitcherSearchProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      clearTimeout(timer.current);
    };
  }, []);

  const onChange = (value: string) => {
    setQuery(value);
    clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setHits([]);
      setOpen(false);
      setStatus("idle");
      return;
    }
    timer.current = setTimeout(async () => {
      const mine = ++seq.current;
      setStatus("loading");
      try {
        const found = await searchPitchers(value.trim());
        if (mine !== seq.current) return;
        setHits(found);
        setStatus("done");
        setOpen(true);
        setActive(-1);
      } catch {
        if (mine !== seq.current) return;
        setHits([]);
        setStatus("error");
        setOpen(true);
      }
    }, 300);
  };

  const choose = (hit: SearchHit) => {
    const team = teamById(hit.teamId);
    if (!team || selected.some((p) => p.id === hit.id)) return;
    onAdd({ id: hit.id, fullName: hit.fullName, pitchHand: hit.pitchHand, teamId: team.id, teamName: team.name });
    setQuery("");
    setHits([]);
    setOpen(false);
    setStatus("idle");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(hits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="psearch" ref={box}>
      <label className="field" htmlFor="pitcher-add">
        <span className="sr-only">Add an opposing starting pitcher</span>
        <input
          id="pitcher-add"
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="pitcher-add-list"
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `pitcher-hit-${hits[active]?.id}` : undefined}
          value={query}
          placeholder="Add a pitcher… e.g. Skubal"
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {status === "loading" && <span className="spin" aria-label="Searching" />}
      </label>
      {open && (
        <ul className="hits" id="pitcher-add-list" role="listbox" aria-label="Matching pitchers">
          {status === "error" && <li className="hit-msg">Search failed — MLB didn&apos;t answer. Try again.</li>}
          {status === "done" && hits.length === 0 && <li className="hit-msg">No active pitchers named “{query}”.</li>}
          {hits.map((h, i) => {
            const team = teamById(h.teamId);
            const taken = selected.some((p) => p.id === h.id);
            const disabled = taken || !team;
            return (
              <li
                key={h.id}
                id={`pitcher-hit-${h.id}`}
                role="option"
                aria-selected={i === active}
                aria-disabled={disabled}
                className={`${i === active ? "act" : ""}${disabled ? " off" : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!disabled) choose(h);
                }}
              >
                <b>{h.fullName}</b>
                <span>
                  {h.pitchHand}HP{team ? ` · ${team.name}` : " · no MLB club"}
                  {taken ? " · already watching" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
