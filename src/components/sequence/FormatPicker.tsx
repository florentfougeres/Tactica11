import type { SeqFormat } from "../../sequence/types";

const FORMATS: { value: SeqFormat; label: string; hint: string }[] = [
  { value: "9:16", label: "9:16", hint: "TikTok, Reels, Shorts" },
  { value: "16:9", label: "16:9", hint: "YouTube" },
  { value: "1:1", label: "1:1", hint: "Publication carrée" },
];

// Output format of the preview / export (the editor itself has none).
export default function FormatPicker({
  value,
  onChange,
  disabled,
  compact = false,
}: {
  value: SeqFormat;
  onChange: (f: SeqFormat) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="seg" role="group" aria-label="Format de la vidéo">
      {FORMATS.map((f) => (
        <button
          key={f.value}
          type="button"
          disabled={disabled}
          title={f.hint}
          className={`seg__btn ${value === f.value ? "is-active" : ""}`}
          onClick={() => onChange(f.value)}
        >
          {compact ? f.label : `${f.label} · ${f.hint}`}
        </button>
      ))}
    </div>
  );
}
