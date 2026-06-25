import LZString from "lz-string";
import { FILE_VERSION, type Lineup, type LineupFile } from "./types";

// Encode a whole lineup into a compact, URL-safe string (no backend).
export function encodeLineup(lineup: Lineup): string {
  const file: LineupFile = { app: "tactica11", version: FILE_VERSION, lineup };
  return LZString.compressToEncodedURIComponent(JSON.stringify(file));
}

export function decodeLineup(encoded: string): Lineup | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const data = JSON.parse(json) as Partial<LineupFile> & Partial<Lineup>;
    const lineup = (data as LineupFile).lineup ?? (data as Lineup);
    if (!lineup || !lineup.slots || !lineup.players) return null;
    return lineup;
  } catch {
    return null;
  }
}

// Full shareable URL with the compo in the hash fragment.
export function buildShareUrl(lineup: Lineup): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#c=${encodeLineup(lineup)}`;
}

// If the page was opened on a share link, return the encoded payload (and
// strip it from the URL so a refresh doesn't re-import).
export function takeSharedFromUrl(): string | null {
  const m = location.hash.match(/[#&]c=([^&]+)/);
  if (!m) return null;
  history.replaceState(null, "", location.pathname + location.search);
  return m[1];
}
