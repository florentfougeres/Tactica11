import Papa from "papaparse";
import type { AttrType } from "./types";

// Parse CSV text into rows of string cells. Papa auto-detects the delimiter
// (comma, semicolon, tab…) and handles quoted fields. Fully empty rows are
// dropped so a trailing newline doesn't create a phantom player.
export function parseCsv(text: string): string[][] {
  const res = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  return (res.data as string[][]).filter((row) =>
    row.some((cell) => (cell ?? "").trim() !== ""),
  );
}

export interface ImportedPlayer {
  name: string;
  number?: number;
  // Extra column values beyond name/number, keyed by column label (header
  // text, or "Colonne N" when there's no header) — resolved to attribute
  // columns by the caller.
  attributes?: Record<string, string | number>;
}

export interface ImportedColumn {
  index: number;
  label: string;
  type: AttrType;
}

function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const NAME_HEADERS = ["nom", "name", "joueur", "player"];
const NUMBER_HEADERS = [
  "numero",
  "num",
  "no",
  "n",
  "n°",
  "dossard",
  "number",
  "shirt",
];

function isNumericCell(cell: string): boolean {
  const v = cell.trim();
  return v !== "" && !Number.isNaN(Number(v));
}

// Guess whether the first row is a header: either it names a well-known
// column (nom, numéro…), or some column is all-numeric in the rest of the
// rows but isn't numeric in row 0.
export function guessHasHeader(rows: string[][]): boolean {
  if (rows.length === 0) return false;
  const header = rows[0];
  if (header.some((c) => {
    const n = normalizeHeader(c);
    return NAME_HEADERS.includes(n) || NUMBER_HEADERS.includes(n);
  })) {
    return true;
  }
  if (rows.length < 2) return false;
  const dataRows = rows.slice(1);
  return header.some((cell, i) => {
    if (isNumericCell(cell)) return false;
    const colValues = dataRows
      .map((r) => r[i] ?? "")
      .filter((v) => v.trim() !== "");
    return colValues.length > 0 && colValues.every(isNumericCell);
  });
}

// Guess which columns hold the player's name and (optional) shirt number,
// from header text when there's a header, else from the shape of the data
// (a column that's all-numeric is very likely the number, not the name).
export function guessColumns(
  rows: string[][],
  hasHeader: boolean,
): { nameCol: number; numberCol: number } {
  const colCount = rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (hasHeader) {
    const header = rows[0];
    const nameCol = header.findIndex((c) =>
      NAME_HEADERS.includes(normalizeHeader(c)),
    );
    const numberCol = header.findIndex((c) =>
      NUMBER_HEADERS.includes(normalizeHeader(c)),
    );
    if (nameCol >= 0 || numberCol >= 0) {
      return { nameCol: nameCol >= 0 ? nameCol : 0, numberCol };
    }
  }

  const data = hasHeader ? rows.slice(1) : rows;
  let numberCol = -1;
  for (let i = 0; i < colCount; i++) {
    const values = data.map((r) => r[i] ?? "").filter((v) => v.trim() !== "");
    if (values.length > 0 && values.every(isNumericCell)) {
      numberCol = i;
      break;
    }
  }
  const nameCol = numberCol === 0 && colCount > 1 ? 1 : 0;
  return { nameCol, numberCol };
}

// Every column besides the chosen name/number ones, with a label (header
// text, or a generic "Colonne N") and a type inferred from the data — only
// "number" when every non-empty value in the column parses as one.
export function detectExtraColumns(
  rows: string[][],
  opts: { hasHeader: boolean; nameCol: number; numberCol: number },
): ImportedColumn[] {
  const colCount = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const data = opts.hasHeader ? rows.slice(1) : rows;
  const cols: ImportedColumn[] = [];
  for (let i = 0; i < colCount; i++) {
    if (i === opts.nameCol || i === opts.numberCol) continue;
    const header = opts.hasHeader ? rows[0]?.[i]?.trim() : "";
    const label = header || `Colonne ${i + 1}`;
    const values = data
      .map((r) => (r[i] ?? "").trim())
      .filter((v) => v !== "");
    const type: AttrType =
      values.length > 0 && values.every(isNumericCell) ? "number" : "text";
    cols.push({ index: i, label, type });
  }
  return cols;
}

// Turn parsed rows into players, given the chosen columns, header flag, and
// any extra columns to carry along as custom attributes.
export function rowsToPlayers(
  rows: string[][],
  opts: {
    hasHeader: boolean;
    nameCol: number;
    numberCol: number;
    extraCols?: ImportedColumn[];
  },
): ImportedPlayer[] {
  const data = opts.hasHeader ? rows.slice(1) : rows;
  const players: ImportedPlayer[] = [];
  for (const row of data) {
    const name = (row[opts.nameCol] ?? "").trim();
    if (!name) continue;
    const player: ImportedPlayer = { name };
    if (opts.numberCol >= 0) {
      const n = parseInt((row[opts.numberCol] ?? "").trim(), 10);
      if (!Number.isNaN(n)) player.number = n;
    }
    if (opts.extraCols?.length) {
      const attributes: Record<string, string | number> = {};
      for (const col of opts.extraCols) {
        const raw = (row[col.index] ?? "").trim();
        if (!raw) continue;
        if (col.type === "number") {
          const n = Number(raw);
          if (!Number.isNaN(n)) attributes[col.label] = n;
        } else {
          attributes[col.label] = raw;
        }
      }
      if (Object.keys(attributes).length > 0) player.attributes = attributes;
    }
    players.push(player);
  }
  return players;
}
