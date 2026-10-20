import { describe, expect, it } from "vitest";
import { parsePosition } from "./types";

describe("parsePosition", () => {
  it("reads codes and labels, ignoring case and accents", () => {
    expect(parsePosition("dc")).toBe("DC");
    expect(parsePosition(" Defenseur Central ")).toBe("DC");
    expect(parsePosition("Avant-centre")).toBe("BU");
    expect(parsePosition("libéro")).toBeUndefined();
  });
});
