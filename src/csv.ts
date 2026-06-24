import Papa from "papaparse";

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
}

// Turn parsed rows into players, given the chosen columns and header flag.
export function rowsToPlayers(
  rows: string[][],
  opts: { hasHeader: boolean; nameCol: number; numberCol: number },
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
    players.push(player);
  }
  return players;
}
