import type { Lineup, Player } from "../../../types";
import type { SequenceActions } from "../../../hooks/useSequenceActions";
import type {
  SeqStep,
  Sequence,
  Team,
} from "../../../sequence/types";
import { SEQ_COLORS } from "../../../sequence/types";
import type { ActorInfo } from "../../../sequence/SequenceStage";

export { default as Switch } from "../../Switch";

// Props shared by the inspector and each of its tabs.
export interface Props {
  seq: Sequence;
  sequences: Sequence[];
  lineup: Lineup;
  players: Player[]; // project roster
  playerById: (id: string | null) => Player | null;
  step: SeqStep;
  stepIndex: number;
  editable: boolean;
  info: Record<string, ActorInfo>;
  selActors: Set<string>;
  selAnn: string | null;
  propagate: boolean;
  focusLabel: number;
  actions: SequenceActions;
  onSeqId: (id: string | null) => void;
  onCreated: (id: string) => void; // new / duplicated sequence → open + rename
  autoRename: boolean;
  onRenameDone: () => void;
  onSelectActors: (s: Set<string>) => void;
  onSelectAnn: (id: string | null) => void;
  onPropagate: (v: boolean) => void;
  onGoToStep: (i: number) => void;
  onAddStep: () => void;
  onFrameSelection: () => void;
  onResetCamera: () => void;
  onAddActor: (team: Team) => void;
  onDeleteSelection: () => void;
}

export const sec = (ms: number) => Math.round(ms / 100) / 10;

export function Swatches({ value, onPick, colors = SEQ_COLORS }: { value: string; onPick: (c: string) => void; colors?: string[] }) {
  return (
    <div className="seq-swatches">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={`opp-swatch ${c.toLowerCase() === value.toLowerCase() ? "is-active" : ""}`}
          style={{ background: c }}
          onClick={() => onPick(c)}
          aria-label={`Couleur ${c}`}
        />
      ))}
      <input type="color" className="seq-color" value={value} onChange={(e) => onPick(e.target.value)} aria-label="Couleur personnalisée" />
    </div>
  );
}
