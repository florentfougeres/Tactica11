import LZString from "lz-string";
import type { Lineup, Project } from "./types";
import {
  buildLineupFile,
  parseLineupBundle,
  type ImportedBundle,
} from "./storage";

// Encode a compo into a compact, URL-safe string (no backend). Self-contained:
// embeds only the players (and attribute columns) referenced by its slots, not
// the whole project roster.
export function encodeLineup(project: Project, lineup: Lineup): string {
  const file = buildLineupFile(project, lineup);
  return LZString.compressToEncodedURIComponent(JSON.stringify(file));
}

export function decodeLineup(encoded: string): ImportedBundle | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return parseLineupBundle(json);
  } catch {
    return null;
  }
}

// Full shareable URL with the compo in the hash fragment.
export function buildShareUrl(project: Project, lineup: Lineup): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#c=${encodeLineup(project, lineup)}`;
}

// If the page was opened on a share link, return the encoded payload (and
// strip it from the URL so a refresh doesn't re-import).
export function takeSharedFromUrl(): string | null {
  const m = location.hash.match(/[#&]c=([^&]+)/);
  if (!m) return null;
  history.replaceState(null, "", location.pathname + location.search);
  return m[1];
}
