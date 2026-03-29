"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { SelectedPitcher } from "@/lib/types";
import PitcherChip from "./PitcherChip";

interface SearchResult {
  id: number;
  fullName: string;
  pitchHand?: { code: string };
  currentTeam?: { id: number; name: string };
}

const PITCHER_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#059669", // emerald
  "#7c3aed", // violet
  "#d97706", // amber
  "#0891b2", // cyan
  "#be185d", // pink
  "#4f46e5", // indigo
];

interface PitcherSearchProps {
  selectedPitchers: SelectedPitcher[];
  onAdd: (pitcher: SelectedPitcher) => void;
  onRemove: (id: number) => void;
}

export default function PitcherSearch({
  selectedPitchers,
  onAdd,
  onRemove,
}: PitcherSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.players || []);
      setIsOpen(true);
      setHighlightIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const selectPitcher = async (result: SearchResult) => {
    if (selectedPitchers.some((p) => p.id === result.id)) return;

    // Fetch full player details to get currentTeam
    let teamId = result.currentTeam?.id;
    let teamName = result.currentTeam?.name;

    if (!teamId) {
      try {
        const res = await fetch(`/api/player/${result.id}`);
        const data = await res.json();
        teamId = data.player?.currentTeam?.id;
        teamName = data.player?.currentTeam?.name;
      } catch {
        // skip if we can't resolve team
      }
    }

    if (!teamId || !teamName) return;

    onAdd({
      id: result.id,
      fullName: result.fullName,
      pitchHand: result.pitchHand?.code || "R",
      teamId,
      teamName,
    });

    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      selectPitcher(results[highlightIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="w-full max-w-md">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Search for opponent starting pitchers
      </label>

      {/* Selected pitchers */}
      {selectedPitchers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedPitchers.map((p, i) => (
            <PitcherChip
              key={p.id}
              pitcher={p}
              onRemove={onRemove}
              color={PITCHER_COLORS[i % PITCHER_COLORS.length]}
            />
          ))}
        </div>
      )}

      {/* Search input */}
      <div ref={containerRef} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a pitcher's name (e.g. Skubal)..."
          className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-gray-900 text-base
                     placeholder:text-gray-400
                     focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none
                     transition-colors"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Dropdown */}
        {isOpen && results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {results.map((r, i) => {
              const alreadySelected = selectedPitchers.some((p) => p.id === r.id);
              return (
                <li
                  key={r.id}
                  className={`px-4 py-3 cursor-pointer transition-colors
                    ${i === highlightIndex ? "bg-blue-50" : "hover:bg-gray-50"}
                    ${alreadySelected ? "opacity-50 cursor-not-allowed" : ""}
                    ${i > 0 ? "border-t border-gray-100" : ""}
                  `}
                  onClick={() => !alreadySelected && selectPitcher(r)}
                  onMouseEnter={() => setHighlightIndex(i)}
                >
                  <div className="font-medium text-gray-900">{r.fullName}</div>
                  <div className="text-sm text-gray-500">
                    {r.pitchHand?.code === "L" ? "LHP" : "RHP"}
                    {r.currentTeam ? ` \u2014 ${r.currentTeam.name}` : ""}
                    {alreadySelected ? " (already selected)" : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {isOpen && results.length === 0 && !loading && query.length >= 2 && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-gray-500 text-sm">
            No pitchers found for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
