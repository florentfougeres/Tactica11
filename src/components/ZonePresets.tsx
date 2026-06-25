import {
  FOCUS_LABEL,
  type RolePreset,
  type ZoneFocus,
} from "../zonePresets";

interface Props {
  presets: RolePreset[];
  focus: ZoneFocus;
  activeKey: string | null;
  onFocus: (focus: ZoneFocus) => void;
  onPick: (key: string) => void;
}

const FOCUSES: ZoneFocus[] = ["defense", "balanced", "attack"];

// Contextual bar of EA-FC-style role presets for the selected player, plus a
// defense/balanced/attack focus toggle.
export default function ZonePresets({
  presets,
  focus,
  activeKey,
  onFocus,
  onPick,
}: Props) {
  return (
    <div className="zone-presets">
      <div className="zone-presets__focus" role="group" aria-label="Focus">
        {FOCUSES.map((f) => (
          <button
            key={f}
            className={`zone-presets__focus-btn ${focus === f ? "is-active" : ""}`}
            onClick={() => onFocus(f)}
          >
            {FOCUS_LABEL[f]}
          </button>
        ))}
      </div>
      <div className="zone-presets__roles">
        {presets.map((p) => (
          <button
            key={p.key}
            className={`zone-presets__role ${activeKey === p.key ? "is-active" : ""}`}
            onClick={() => onPick(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
