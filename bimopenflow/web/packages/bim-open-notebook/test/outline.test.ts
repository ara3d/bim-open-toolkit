// Offline tests for scripts/outline.ts and scripts/snowdon.ts: outline
// validation and the placeholder transforms, none of which need a running host.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expandPlaceholders, hidePlaceholders, outlineErrors, outlineRoot, parsePlaceholders, slashed } from "../scripts/outline";
import { snowdonPath } from "../scripts/snowdon";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "fixtures");
const FIXTURE_OUTLINE = JSON.parse(readFileSync(join(FIXTURES, "nb-fixture.outline.json"), "utf8"));

// The fixture's own graph ids ("nb-fixture-carbon", "nb-fixture-chart") were
// written for the outline name "fixture" (nb-<name>-), unlike its file name
// (nb-fixture.outline.json, kept as committed): real outlines under
// samples/notebooks/outlines never carry a leading "nb-" in their own name.
const FIXTURE_NAME = "fixture";

describe("outlineErrors", () => {
  it("accepts the fixture outline, named for its own graph-id prefix", () => {
    expect(outlineErrors(FIXTURE_OUTLINE, FIXTURE_NAME)).toEqual([]);
  });

  it("accepts the fixture outline when no name is given (the prefix check is skipped)", () => {
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

  it("rejects a graph id that does not start with nb-<outline name>-", () => {
    const withBadGraph = { ...FIXTURE_OUTLINE, graphs: ["graphs/other-thing.json"] };
    const errors = outlineErrors(withBadGraph, FIXTURE_NAME);
    expect(errors).toEqual([`graphs[0]: graph id "other-thing" must start with "nb-fixture-"`]);
  });

  it("passes every committed outline's own graph-id prefix check", () => {
    const outlinesDir = join(outlineRoot(join(FIXTURES, "nb-fixture.outline.json")), "samples", "notebooks", "outlines");
    for (const file of readdirSync(outlinesDir)) {
      if (!file.endsWith(".outline.json")) continue;
      const name = file.replace(/\.outline\.json$/, "");
      const outline = JSON.parse(readFileSync(join(outlinesDir, file), "utf8"));
      expect(outlineErrors(outline, name), file).toEqual([]);
    }
  });
});

describe("parsePlaceholders", () => {
  it("reads each --placeholder NAME=path, resolving the path", () => {
    const placeholders = parsePlaceholders(["--host", "h", "--placeholder", "PUBLIC=C:/w/public", "--placeholder", "SNOWDON=C:/m/s.bos"]);
    expect([...placeholders.keys()]).toEqual(["PUBLIC", "SNOWDON"]);
    expect(slashed(placeholders.get("PUBLIC")!)).toBe(slashed(resolve("C:/w/public")));
  });

  it("rejects a name given twice", () => {
    expect(() => parsePlaceholders(["--placeholder", "A=x", "--placeholder", "A=y"])).toThrow(/A is given twice/);
  });

  it("rejects a value that is not NAME=path", () => {
    for (const bad of ["nope", "lower=x", "EMPTY=", "=x"]) expect(() => parsePlaceholders(["--placeholder", bad]), bad).toThrow(/NAME=path/);
    expect(() => parsePlaceholders(["--placeholder"])).toThrow(/NAME=path/);
  });
});

describe("placeholder round trip", () => {
  const PUBLIC = "C:/w/nb/deps/bim-open-data/samples/public";
  const placeholders = new Map([["PUBLIC", PUBLIC]]);

  it("expandPlaceholders leaves text with no placeholder untouched", () => {
    expect(expandPlaceholders("no placeholder here", "x.json", new Map())).toBe("no placeholder here");
  });

  it("expandPlaceholders fills each placeholder, and hidePlaceholders turns it back", () => {
    const text = '{"path":"{PUBLIC}/schependomlaan.duckdb"}';
    const expanded = expandPlaceholders(text, "g.json", placeholders);
    expect(expanded).toBe(`{"path":"${PUBLIC}/schependomlaan.duckdb"}`);
    expect(hidePlaceholders(expanded, placeholders, "C:/elsewhere")).toBe(text);
  });

  it("expandPlaceholders writes a Windows path with forward slashes", () => {
    expect(expandPlaceholders('"{M}"', "g.json", new Map([["M", "C:\\m\\s.bos"]]))).toBe('"C:/m/s.bos"');
  });

  it("expandPlaceholders throws naming the graph and the option when a placeholder has no entry", () => {
    expect(() => expandPlaceholders('"model": "{SNOWDON}"', "g.json", placeholders)).toThrow(
      "g.json needs {SNOWDON}; pass --placeholder SNOWDON=<path>",
    );
  });

  it("hidePlaceholders hides the longer of two nested paths first", () => {
    const nested = new Map([["DATA", "C:/d"], ["PUBLIC", "C:/d/public"]]);
    expect(hidePlaceholders('"C:/d/public/a" "C:/d/b"', nested, "C:/elsewhere")).toBe('"{PUBLIC}/a" "{DATA}/b"');
  });

  it("hidePlaceholders does not corrupt arbitrary text when a placeholder's path is empty (the empty-string split bug)", () => {
    const text = '{"a": "b", "c": "d"}';
    expect(hidePlaceholders(text, new Map([["EMPTY", ""]]), "C:/elsewhere")).toBe(text);
  });

  it("hidePlaceholders strips the root prefix", () => {
    const root = outlineRoot(join(FIXTURES, "nb-fixture.outline.json"));
    const text = `"path": "${slashed(root)}/samples/nrc/questions.txt"`;
    expect(hidePlaceholders(text, new Map(), root)).toBe('"path": "samples/nrc/questions.txt"');
  });
});

describe("snowdonPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is the file BIMOPENFLOW_SNOWDON names when it exists", () => {
    const stand = join(FIXTURES, "nb-fixture.picture.svg"); // stands in for a .bos file that exists
    vi.stubEnv("BIMOPENFLOW_SNOWDON", stand);
    expect(snowdonPath()).toBe(stand);
  });

  it("an empty BIMOPENFLOW_SNOWDON is treated as unset, not as the path itself (never an empty string)", () => {
    vi.stubEnv("BIMOPENFLOW_SNOWDON", "");
    // Whichever branch resolves (the machine's own default location may or
    // may not exist), the old `?? ` bug's "" result can never come back.
    expect(snowdonPath()).not.toBe("");
  });

  it("is undefined when the named file does not exist", () => {
    vi.stubEnv("BIMOPENFLOW_SNOWDON", join(FIXTURES, "does-not-exist.bos"));
    expect(snowdonPath()).toBeUndefined();
  });
});

describe("slashed and outlineRoot", () => {
  it("slashed turns backslashes into forward slashes", () => {
    expect(slashed("a\\b\\c")).toBe("a/b/c");
  });

  it("outlineRoot is the git checkout that holds the outline", () => {
    expect(slashed(outlineRoot(join(FIXTURES, "nb-fixture.outline.json"))).endsWith("bim-open-toolkit")).toBe(true);
  });
});
