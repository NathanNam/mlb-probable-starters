"use client";

import { useEffect, useState } from "react";

interface Team {
  id: number;
  name: string;
  abbreviation: string;
  division: { id: number; name: string };
  league: { id: number; name: string };
}

const DIVISION_ORDER = [
  "American League East",
  "American League Central",
  "American League West",
  "National League East",
  "National League Central",
  "National League West",
];

interface TeamPickerProps {
  onSelect: (team: Team) => void;
  selectedTeam: Team | null;
}

export default function TeamPicker({ onSelect, selectedTeam }: TeamPickerProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teams")
      .then((res) => res.json())
      .then((data) => {
        setTeams(data.teams || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse h-12 bg-gray-200 rounded-lg w-full max-w-md" />
    );
  }

  // Group by division
  const grouped = new Map<string, Team[]>();
  for (const team of teams) {
    const divName = `${team.league.name} ${team.division.name.replace(team.league.name + " ", "")}`;
    if (!grouped.has(divName)) grouped.set(divName, []);
    grouped.get(divName)!.push(team);
  }

  return (
    <div className="w-full max-w-md">
      <label
        htmlFor="team-select"
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        Select your home team
      </label>
      <select
        id="team-select"
        value={selectedTeam?.id ?? ""}
        onChange={(e) => {
          const team = teams.find((t) => t.id === Number(e.target.value));
          if (team) onSelect(team);
        }}
        className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-gray-900 text-base
                   focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none
                   transition-colors cursor-pointer"
      >
        <option value="">Choose a team...</option>
        {DIVISION_ORDER.map((divName) => {
          const divTeams = grouped.get(divName);
          if (!divTeams) return null;
          return (
            <optgroup key={divName} label={divName}>
              {divTeams
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}
