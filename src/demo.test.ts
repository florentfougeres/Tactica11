import { describe, expect, it } from "vitest";
import { createDemoProject } from "./demo";
import { migrateSequence } from "./sequence/create";

describe("createDemoProject", () => {
  const project = createDemoProject();
  const playerIds = new Set(project.players.map((p) => p.id));

  it("only references roster players", () => {
    project.lineups.forEach((l) =>
      l.slots.forEach((s) => {
        expect(s.starterId && playerIds.has(s.starterId)).toBe(true);
        if (s.subId) expect(playerIds.has(s.subId)).toBe(true);
      }),
    );
    project.lineups[0].setPieces.forEach((sp) =>
      sp.tokens.forEach((t) => expect(playerIds.has(t.playerId)).toBe(true)),
    );
  });

  it("has complete sequences that survive loading", () => {
    const seqs = project.lineups[0].sequences ?? [];
    expect(seqs.map((q) => q.name)).toEqual([
      "Sortie à 3",
      "Renversement",
      "Latéral intérieur",
      "Pressing haut",
    ]);
    seqs.forEach((q) => {
      const actorIds = new Set(q.actors.map((a) => a.id));
      q.steps.forEach((s) => {
        q.actors.forEach((a) => expect(s.positions[a.id]).toBeDefined());
        if ("carrierId" in s.ball) expect(actorIds.has(s.ball.carrierId)).toBe(true);
      });
      q.annotations.forEach((a) =>
        a.anchors.forEach((an) => {
          if ("actorId" in an) expect(actorIds.has(an.actorId)).toBe(true);
          else expect(Number.isFinite(an.pos.x) && Number.isFinite(an.pos.y)).toBe(true);
        }),
      );
      // Loading drops nothing (annotations pointing at unknown steps would go).
      expect(migrateSequence(q).annotations).toHaveLength(q.annotations.length);
    });
  });
});
