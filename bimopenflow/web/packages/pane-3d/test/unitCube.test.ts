import { describe, expect, it } from "vitest";
import { UNIT_CUBE } from "../src/unitCube";

describe("UNIT_CUBE", () => {
  it("is a flat-shaded cube: 24 vertices, 12 triangles, edge 1, centered", () => {
    expect(UNIT_CUBE.positions.length).toBe(24 * 3);
    expect(UNIT_CUBE.normals!.length).toBe(24 * 3);
    expect(UNIT_CUBE.indices!.length).toBe(36);
    for (const p of UNIT_CUBE.positions) expect(Math.abs(p)).toBe(0.5);
    for (const i of UNIT_CUBE.indices!) expect(i).toBeLessThan(24);
    // each vertex normal is a unit axis vector
    for (let v = 0; v < 24; v++) {
      const n = [...UNIT_CUBE.normals!.slice(v * 3, v * 3 + 3)];
      expect(Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2])).toBe(1);
    }
  });
});
