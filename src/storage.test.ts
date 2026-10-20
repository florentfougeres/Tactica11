import { describe, expect, it } from "vitest";
import { createDefaultProject, createSetPiece, mergeProjectParts } from "./storage";
import { createSequence } from "./sequence/create";
import type { Project } from "./types";

// A source project with one compo: Zidane starting, Henry on the bench of the
// roster only, a corner using Zidane and a sequence whose first disc shows him.
function makeSource(): Project {
  const p = createDefaultProject();
  p.players = [
    { id: "zz", name: "Zidane", number: 10, attributes: { a1: 90 } },
    { id: "th", name: "Henry" },
  ];
  p.attributeDefs = [{ id: "a1", name: "Vitesse", type: "number" }];
  const l = p.lineups[0];
  l.slots[0].starterId = "zz";
  const corner = createSetPiece("corner", 0);
  corner.tokens = [
    { id: "t1", playerId: "zz", positions: { start: { x: 0, y: 0 }, mid: { x: 0, y: 0 }, end: { x: 0, y: 0 } } },
  ];
  l.setPieces = [corner, createSetPiece("free-kick", 1)];
  const seq = createSequence(l, "base", "Pressing");
  seq.actors[0].playerId = "zz";
  l.sequences = [seq, createSequence(l, "base", "Autre")];
  return p;
}

describe("mergeProjectParts", () => {
  it("adds only the picked parts as a new compo with fresh ids", () => {
    const source = makeSource();
    const target = createDefaultProject();
    const l = source.lineups[0];
    const { project, lineups } = mergeProjectParts(target, source, {
      picks: [
        { lineupId: l.id, setPieceIds: [l.setPieces[0].id], sequenceIds: [l.sequences![0].id] },
      ],
      matchByName: true,
      wholeRoster: false,
    });

    expect(project.lineups).toHaveLength(2);
    const added = lineups[0];
    expect(added.id).not.toBe(l.id);
    expect(added.setPieces.map((sp) => sp.name)).toEqual(["Corner 1"]);
    expect(added.sequences?.map((q) => q.name)).toEqual(["Pressing"]);
    expect(added.sequences![0].id).not.toBe(l.sequences![0].id);

    // Only the referenced player comes along, with a fresh id used everywhere.
    expect(project.players.map((p) => p.name)).toEqual(["Zidane"]);
    const zz = project.players[0];
    expect(zz.id).not.toBe("zz");
    expect(added.slots[0].starterId).toBe(zz.id);
    expect(added.setPieces[0].tokens[0].playerId).toBe(zz.id);
    expect(added.sequences![0].actors[0].playerId).toBe(zz.id);
    // Its attribute column is created and the value remapped.
    expect(project.attributeDefs).toHaveLength(1);
    expect(zz.attributes).toEqual({ [project.attributeDefs[0].id]: 90 });
  });

  it("maps players onto same-named roster players and can bring the whole roster", () => {
    const source = makeSource();
    const target = createDefaultProject();
    target.players = [{ id: "mine", name: " zidane " }];
    const { project, lineups } = mergeProjectParts(target, source, {
      picks: [{ lineupId: source.lineups[0].id, setPieceIds: [], sequenceIds: [] }],
      matchByName: true,
      wholeRoster: true,
    });
    expect(project.players.map((p) => p.name)).toEqual([" zidane ", "Henry"]);
    expect(lineups[0].slots[0].starterId).toBe("mine");
    expect(lineups[0].setPieces).toEqual([]);
    expect(lineups[0].sequences).toBeUndefined();
    // Matched players aren't added, so their columns aren't either.
    expect(project.attributeDefs).toEqual([]);
  });
});
