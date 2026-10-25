import { DIVISIONS, TEAMS } from "@/lib/teams";

interface TeamSelectProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (teamId: number | null) => void;
  emptyLabel: string;
}

/** Club picker grouped by division. Uses the visible label only for screen readers. */
export default function TeamSelect({ id, label, value, onChange, emptyLabel }: TeamSelectProps) {
  return (
    <label className="field field-select" htmlFor={id}>
      <span className="sr-only">{label}</span>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">{emptyLabel}</option>
        {DIVISIONS.map((div) => (
          <optgroup key={div.label} label={div.label}>
            {TEAMS.filter((t) => t.league === div.league && t.division === div.division)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
