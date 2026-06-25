import type { RolePreset } from "../zonePresets";

interface Props {
  presets: RolePreset[];
  activeKey: string | null;
  onPick: (key: string) => void;
}

// Contextual bar of EA-FC-style role presets for the selected player.
export default function ZonePresets({ presets, activeKey, onPick }: Props) {
  return (
    <div className="zone-presets">
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
  );
}
