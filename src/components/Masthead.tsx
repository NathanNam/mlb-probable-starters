import type { Tab } from "@/lib/urlState";

const LABELS: Record<Tab, string> = {
  slate: "Daily slate",
  rotation: "Rotation watch",
  pitchers: "Pitchers",
};

export default function Masthead({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <header className="mast">
      <div className="pennant">
        <div>
          <h1>Probable Starters</h1>
          <small>Who&apos;s on the mound · daily card</small>
        </div>
      </div>
      <nav className="tabs" aria-label="Sections">
        {(Object.keys(LABELS) as Tab[]).map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} className={tab === t ? "on" : ""} onClick={() => onTab(t)}>
            {LABELS[t]}
          </button>
        ))}
      </nav>
    </header>
  );
}
