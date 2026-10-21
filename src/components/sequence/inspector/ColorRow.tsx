// One colour setting as a compact row: label on the left, a chip of the
// current colour (split in two for a two-colour kit) on the right. The chip
// opens the palette in a small popover, so a list of colours stays a list
// instead of a wall of swatches.
import type { ReactNode } from "react";
import { discBackground } from "../../../colors";
import PopMenu from "../../PopMenu";

export default function ColorRow({
  label,
  value,
  value2,
  popTitle,
  children,
}: {
  label: string;
  popTitle?: string; // popover heading when the label alone lacks context
  value: string;
  value2?: string;
  children: ReactNode; // the picker shown in the popover
}) {
  return (
    <div className="pitch-ctl__row seq-color-row">
      <span>{label}</span>
      <PopMenu
        button={<span className="seq-color-chip__dot" style={{ background: discBackground(value, value2) }} />}
        title={`${label} : changer la couleur`}
        className="seq-color-chip"
        chevron={false}
        align="right"
      >
        <div className="seq-color-pop" data-keep>
          <span className="seq-color-pop__title">{popTitle ?? label}</span>
          {children}
        </div>
      </PopMenu>
    </div>
  );
}
