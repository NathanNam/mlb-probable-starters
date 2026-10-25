import RotationSheet from "./RotationSheet";
import type { RotationResult } from "@/lib/rotation";
import type { Team } from "@/lib/teams";
import type { SelectedPitcher } from "@/lib/types";

interface RotationViewProps {
  home?: Team;
  pitchers: SelectedPitcher[];
  result?: RotationResult;
  loading: boolean;
  error: unknown;
  retry: () => void;
  timeZone: string;
  onSetup: () => void;
}

export function SetupPrompt({ onSetup, home }: { onSetup: () => void; home?: Team }) {
  return (
    <div className="sheet">
      <div className="inner pad">
        <h3 className="plain">Rotation watch</h3>
        <p className="hint">
          Pick {home ? "the opposing starters" : "your home ballpark and the opposing starters"} you want to see. We&apos;ll
          find the home games they&apos;re likely to pitch, from MLB&apos;s announced starters and each pitcher&apos;s
          rotation.
        </p>
        <button type="button" className="btn" onClick={onSetup}>
          Set up rotation watch →
        </button>
      </div>
    </div>
  );
}

export default function RotationView(props: RotationViewProps) {
  const { home, pitchers, onSetup } = props;
  if (!home || pitchers.length === 0) {
    return (
      <div className="single">
        <SetupPrompt onSetup={onSetup} home={home} />
      </div>
    );
  }
  return (
    <div className="single watch">
      <div className="sechead">
        <h2>{home.name} home games</h2>
        <button type="button" className="linkish" onClick={onSetup}>
          Edit pitchers
        </button>
      </div>
      <RotationSheet {...props} home={home} />
    </div>
  );
}
