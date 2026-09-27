// Offline tests for scripts/outline.ts: outline validation and the
// placeholder transforms, none of which need a running host.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ROOT, expandPlaceholders, hidePlaceholders, outlineErrors, slashed, snowdonPath } from "../scripts/outline";

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

describe("placeholder round trip", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("expandPlaceholders leaves text with no {SNOWDON} untouched", () => {
    expect(expandPlaceholders("no placeholder here", "x.json")).toBe("no placeholder here");
  });

  it("expandPlaceholders throws when {SNOWDON} is needed and no model is configured", () => {
    vi.stubEnv("BIMOPENFLOW_SNOWDON", join(FIXTURES, "does-not-exist.bos"));
    expect(() => expandPlaceholders('"model": "{SNOWDON}"', "graph.json")).toThrow(/needs the private Snowdon model/);
  });

  it("expandPlaceholders then hidePlaceholders round-trips a configured Snowdon path", () => {
    const snowdon = join(FIXTURES, "nb-fixture.picture.svg"); // stands in for a .bos file that exists
    vi.stubEnv("BIMOPENFLOW_SNOWDON", snowdon);
    const expanded = expandPlaceholders('"model": "{SNOWDON}"', "graph.json");
    expect(expanded).toBe(`"model": "${slashed(snowdonPath()!)}"`);
    expect(hidePlaceholders(expanded)).toBe('"model": "{SNOWDON}"');
  });

  it("an empty BIMOPENFLOW_SNOWDON is treated as unset, not as the path itself (never an empty string)", () => {
    vi.stubEnv("BIMOPENFLOW_SNOWDON", "");
    // Whichever branch resolves (the machine's own default location may or
    // may not exist), the old `?? ` bug's "" result can never come back.
    expect(snowdonPath()).not.toBe("");
  });

  it("hidePlaceholders does not corrupt arbitrary text when no Snowdon model is configured (the empty-string split bug)", () => {
    vi.stubEnv("BIMOPENFLOW_SNOWDON", "");
    const text = '{"a": "b", "c": "d"}';
    expect(hidePlaceholders(text)).toBe(text);
  });

  it("hidePlaceholders strips this checkout's own root prefix", () => {
    const text = `"path": "${slashed(ROOT)}/samples/nrc/questions.txt"`;
    expect(hidePlaceholders(text)).toBe('"path": "samples/nrc/questions.txt"');
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
