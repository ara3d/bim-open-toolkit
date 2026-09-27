// Offline tests for scripts/outline.ts: outline validation and the
// placeholder transforms, none of which need a running host.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { expandPlaceholders, outlineErrors, slashed, ROOT } from "../scripts/outline";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "fixtures");
const FIXTURE_OUTLINE = JSON.parse(readFileSync(join(FIXTURES, "nb-fixture.outline.json"), "utf8"));

describe("outlineErrors", () => {
  it("accepts the fixture outline", () => {
    expect(outlineErrors(FIXTURE_OUTLINE)).toEqual([]);
  });

  it("collects every problem of a broken outline instead of stopping at the first", () => {
    const broken = {
      title: "broken",
      // createdUtc missing
      host: { profile: "bim", extra: "not allowed" },
      turns: [{ request: "hi" /* reply missing */ }],
    };
    const errors = outlineErrors(broken);
    expect(errors).toContain("createdUtc: missing");
    expect(errors).toContain("host.extra: unknown field");
    expect(errors).toContain("turns[0].reply: missing");
  });
});

describe("expandPlaceholders", () => {
  it("leaves text with no {SNOWDON} untouched", () => {
    expect(expandPlaceholders("no placeholder here", "x.json")).toBe("no placeholder here");
  });
});

describe("slashed and ROOT", () => {
  it("slashed turns backslashes into forward slashes", () => {
    expect(slashed("a\\b\\c")).toBe("a/b/c");
  });

  it("ROOT resolves to the repository root", () => {
    expect(slashed(ROOT).endsWith("bim-open-toolkit")).toBe(true);
  });
});
