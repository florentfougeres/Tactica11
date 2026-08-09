import type { Orient, Player, Slot, StudioDiscStyle } from "../types";
import { posToPercent } from "../types";
import JerseyShape from "./JerseyShape";

interface Props {
  slot: Slot;
  starter: Player | null;
  discStyle: StudioDiscStyle;
  discColor: string;
  numberColor: string;
  labelColor: string;
  discSize: number; // % of the field's width
  nameFontSize: number; // px
  showRole: boolean;
  showName: boolean;
  showNumber: boolean;
  orient: Orient;
}

// A static (non-draggable) token for the Studio poster — always the base
// formation position, no drag/motion machinery needed since it never moves.
export default function StudioToken({
  slot,
  starter,
  discStyle,
  discColor,
  numberColor,
  labelColor,
  discSize,
  nameFontSize,
  showRole,
  showName,
  showNumber,
  orient,
}: Props) {
  const { left, top } = posToPercent(slot.positions.base, orient);
  const number = starter?.number;

  return (
    <div
      className={`studio-token ${
        discStyle === "jersey" ? "studio-token--jersey" : ""
      }`}
      style={{ left: `${left}%`, top: `${top}%`, width: `${discSize}%` }}
    >
      <div className="studio-token__disc">
        {discStyle === "jersey" ? (
          <JerseyShape color={discColor} />
        ) : (
          <div
            className="studio-token__circle"
            style={{ background: discColor }}
          />
        )}
        {showNumber && number != null && (
          <span className="studio-token__number" style={{ color: numberColor }}>
            {number}
          </span>
        )}
      </div>
      {(showRole || (showName && starter)) && (
        <div
          className="studio-token__labels"
          style={{ color: labelColor, fontSize: nameFontSize }}
        >
          {showName && starter && (
            <span className="studio-token__name">{starter.name}</span>
          )}
          {showRole && <span className="studio-token__role">{slot.role}</span>}
        </div>
      )}
    </div>
  );
}
