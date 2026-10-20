// On/off toggle row used across the side panels: label on the left, switch on
// the right (styles: .pitch-ctl__row / .switch in styles/pitch-controls.css).
export default function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="pitch-ctl__row">
      <span>{label}</span>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch__track" />
        <span className="switch__thumb" />
      </span>
    </label>
  );
}
