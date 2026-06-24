import { useMemo, useRef, useState } from "react";
import { parseCsv, rowsToPlayers, type ImportedPlayer } from "../csv";

interface Props {
  onClose: () => void;
  onImport: (players: ImportedPlayer[]) => void;
}

export default function CsvImportDialog({ onClose, onImport }: Props) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [hasHeader, setHasHeader] = useState(false);
  const [nameCol, setNameCol] = useState(0);
  const [numberCol, setNumberCol] = useState(-1); // -1 = none
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const colCount = useMemo(
    () => (rows ? rows.reduce((m, r) => Math.max(m, r.length), 0) : 0),
    [rows],
  );

  // A friendly label per column: the header cell if present, else a sample.
  const colLabel = (i: number): string => {
    if (!rows) return `Colonne ${i + 1}`;
    if (hasHeader && rows[0]?.[i]?.trim()) return rows[0][i].trim();
    const sample = (hasHeader ? rows[1] : rows[0])?.[i]?.trim();
    return sample ? `Colonne ${i + 1} · ex. « ${sample} »` : `Colonne ${i + 1}`;
  };

  function ingest(text: string) {
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      setError("Aucune donnée trouvée dans ce fichier.");
      return;
    }
    setError(null);
    setRows(parsed);
    setNameCol(0);
    setNumberCol(-1);
    setHasHeader(false);
  }

  function onFile(file: File) {
    file
      .text()
      .then(ingest)
      .catch(() => setError("Impossible de lire ce fichier."));
  }

  const players = useMemo(
    () =>
      rows ? rowsToPlayers(rows, { hasHeader, nameCol, numberCol }) : [],
    [rows, hasHeader, nameCol, numberCol],
  );

  function confirm() {
    if (players.length === 0) {
      setError("Aucun joueur à importer avec cette sélection.");
      return;
    }
    onImport(players);
    onClose();
  }

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div
        className="modal glass"
        role="dialog"
        aria-label="Importer des joueurs"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <h2>Importer des joueurs (CSV)</h2>
          <button className="modal__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>

        {!rows ? (
          <div className="modal__body">
            <p className="modal__hint">
              Choisis un fichier <code>.csv</code> (export Excel, Google Sheets…)
              ou colle directement une liste ci-dessous.
            </p>
            <button
              className="btn btn--primary"
              onClick={() => fileRef.current?.click()}
            >
              Choisir un fichier…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            <textarea
              className="modal__paste"
              placeholder={"Nom;Numéro\nMbappé;10\nDembélé;7"}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (v) ingest(v);
              }}
            />
            {error && <p className="modal__error">{error}</p>}
          </div>
        ) : (
          <div className="modal__body">
            <label className="modal__check">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
              />
              La première ligne est un en-tête
            </label>

            {colCount > 1 && (
              <div className="modal__cols">
                <label className="modal__field">
                  <span>Colonne du nom</span>
                  <select
                    value={nameCol}
                    onChange={(e) => setNameCol(Number(e.target.value))}
                  >
                    {Array.from({ length: colCount }, (_, i) => (
                      <option key={i} value={i}>
                        {colLabel(i)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="modal__field">
                  <span>Numéro (optionnel)</span>
                  <select
                    value={numberCol}
                    onChange={(e) => setNumberCol(Number(e.target.value))}
                  >
                    <option value={-1}>Aucun</option>
                    {Array.from({ length: colCount }, (_, i) => (
                      <option key={i} value={i}>
                        {colLabel(i)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div className="modal__preview">
              <span className="modal__preview-title">
                Aperçu · {players.length} joueur{players.length > 1 ? "s" : ""}
              </span>
              <ul>
                {players.slice(0, 6).map((p, i) => (
                  <li key={i}>
                    {p.number != null && (
                      <span className="modal__num">{p.number}</span>
                    )}
                    {p.name}
                  </li>
                ))}
                {players.length > 6 && <li className="modal__more">…</li>}
              </ul>
            </div>

            {error && <p className="modal__error">{error}</p>}

            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setRows(null)}>
                Changer de fichier
              </button>
              <button className="btn btn--primary" onClick={confirm}>
                Importer {players.length} joueur{players.length > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
