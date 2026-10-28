import { useState } from "react";
import type { AttrType, AttributeDef, Player } from "../../types";
import FmSelect from "../FmSelect";
import Icon from "../Icon";

interface Props {
  attributeDefs: AttributeDef[];
  players: Player[];
  onAdd: (name: string, type: AttrType) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

// The project's custom player infos (taille, âge…): shown as columns in the
// table and as fields in every fiche.
export default function ColumnsDialog({ attributeDefs, players, onAdd, onRename, onRemove, onClose }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AttrType>("text");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim(), type);
    setName("");
  };

  const remove = (def: AttributeDef) => {
    const filled = players.filter((p) => p.attributes?.[def.id] != null).length;
    if (
      filled &&
      !window.confirm(
        `Supprimer « ${def.name} » ? ${filled} joueur${filled > 1 ? "s ont" : " a"} une valeur renseignée, elle sera perdue.`,
      )
    )
      return;
    onRemove(def.id);
  };

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div className="modal glass" role="dialog" aria-label="Infos joueurs" onPointerDown={(e) => e.stopPropagation()}>
        <header className="modal__header">
          <h2>Infos joueurs</h2>
          <button className="modal__close" onClick={onClose} aria-label="Fermer">
            <Icon name="close" />
          </button>
        </header>
        <div className="modal__body">
          <p className="modal__hint">
            Tes propres infos sur chaque joueur, en plus du poste, du pied et du statut. Elles apparaissent dans la
            fiche et en colonnes dans la table.
          </p>
          {attributeDefs.length > 0 && (
            <ul className="columns-list">
              {attributeDefs.map((d) => (
                <li key={d.id}>
                  <input
                    defaultValue={d.name}
                    aria-label={`Nom de l'info ${d.name}`}
                    onBlur={(e) => e.target.value.trim() && onRename(d.id, e.target.value.trim())}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                  <span className="columns-list__type">{d.type === "number" ? "Nombre" : "Texte"}</span>
                  <button type="button" className="columns-list__remove" onClick={() => remove(d)} aria-label={`Supprimer ${d.name}`}>
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="columns-add" onSubmit={add}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Taille, âge, contrat…" aria-label="Nouvelle info" />
            <FmSelect<AttrType>
              className="columns-add__type"
              value={type}
              options={[
                { value: "text", label: "Texte" },
                { value: "number", label: "Nombre" },
              ]}
              onChange={setType}
              ariaLabel="Type de l'info"
            />
            <button type="submit" className="btn btn--primary">
              Ajouter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
