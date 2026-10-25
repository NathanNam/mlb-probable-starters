"use client";

import { DIVISIONS, TEAMS, type Team } from "@/lib/teams";

interface TeamPickerProps {
  onSelect: (team: Team) => void;
  selectedTeam: Team | null;
}

export default function TeamPicker({ onSelect, selectedTeam }: TeamPickerProps) {
  return (
    <div className="w-full max-w-md">
      <label htmlFor="team-select" className="block text-sm font-medium text-gray-700 mb-2">
        Select your home team
      </label>
      <select
        id="team-select"
        value={selectedTeam?.id ?? ""}
        onChange={(e) => {
          const team = TEAMS.find((t) => t.id === Number(e.target.value));
          if (team) onSelect(team);
        }}
        className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-gray-900 text-base"
      >
        <option value="">Choose a team...</option>
        {DIVISIONS.map((div) => (
          <optgroup key={div.label} label={div.label}>
            {TEAMS.filter((t) => t.league === div.league && t.division === div.division)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
