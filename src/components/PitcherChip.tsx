"use client";

import type { SelectedPitcher } from "@/lib/types";

interface PitcherChipProps {
  pitcher: SelectedPitcher;
  onRemove: (id: number) => void;
  color: string;
}

export default function PitcherChip({ pitcher, onRemove, color }: PitcherChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {pitcher.fullName}
      <span className="text-xs opacity-75">
        ({pitcher.pitchHand}HP) &middot; {pitcher.teamName}
      </span>
      <button
        onClick={() => onRemove(pitcher.id)}
        className="ml-1 rounded-full p-0.5 hover:bg-white/20 transition-colors"
        aria-label={`Remove ${pitcher.fullName}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
