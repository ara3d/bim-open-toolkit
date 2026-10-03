// The generated start-page catalog (scripts/build-flow-templates.mjs).
import { describe, expect, it } from "vitest";
import { TEMPLATES } from "../src/templates.generated.js";

describe("TEMPLATES", () => {
  it("holds at least ten entries, each with an id and a folder", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(10);
    for (const x of TEMPLATES) {
      expect(x.id).not.toBe("");
      expect(x.folder).not.toBe("");
    }
  });

  it("has unique ids sorted by folder then id", () => {
    const keys = TEMPLATES.map((x) => `${x.folder}/${x.id}`);
    expect(new Set(TEMPLATES.map((x) => x.id)).size).toBe(TEMPLATES.length);
    expect(keys).toEqual([...keys].sort());
  });
});
