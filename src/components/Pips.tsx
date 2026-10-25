import type { MatchConfidence } from "@/lib/types";

const COUNT: Record<MatchConfidence, number> = { confirmed: 3, projected: 2, possible: 1 };
const ON: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8] };
export const CONFIDENCE_LABEL: Record<MatchConfidence, string> = {
  confirmed: "Confirmed",
  projected: "Projected",
  possible: "Possible",
};

/** Die face showing confidence: three pips confirmed, two projected, one possible. */
export default function Pips({ confidence, small }: { confidence: MatchConfidence; small?: boolean }) {
  const on = ON[COUNT[confidence]];
  return (
    <span className={`pips${small ? " sm" : ""}`} role="img" aria-label={CONFIDENCE_LABEL[confidence]}>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={on.includes(i) ? "on" : ""} />
      ))}
    </span>
  );
}

/** Scorecard diamond: filled for a start made, open for one still to come. */
export function Diamond({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 28 26" aria-hidden="true" className={filled ? "dia done" : "dia next"}>
      <path d="M14 2 L26 13 L14 24 L2 13 Z" />
      <path d="M14 8 L20 13 L14 18 L8 13 Z" className="infield" />
    </svg>
  );
}
