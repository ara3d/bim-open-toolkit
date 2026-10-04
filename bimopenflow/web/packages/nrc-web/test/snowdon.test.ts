// @vitest-environment node
/// <reference types="node" />
// scripts/snowdon.ts: where the Snowdon model is found, and how it joins the
// notebook script's command line.

import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { snowdonPath, withSnowdonPlaceholder } from "../scripts/snowdon";

const THIS_FILE = fileURLToPath(import.meta.url); // stands in for a .bos file that exists

describe("snowdonPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is the file BIMOPENFLOW_SNOWDON names when it exists", () => {
    vi.stubEnv("BIMOPENFLOW_SNOWDON", THIS_FILE);
    expect(snowdonPath()).toBe(THIS_FILE);
  });

  it("an empty BIMOPENFLOW_SNOWDON is treated as unset, not as the path itself (never an empty string)", () => {
    vi.stubEnv("BIMOPENFLOW_SNOWDON", "");
    // Whichever branch resolves (the machine's own default location may or
    // may not exist), the old `?? ` bug's "" result can never come back.
    expect(snowdonPath()).not.toBe("");
  });

  it("is undefined when the named file does not exist", () => {
    vi.stubEnv("BIMOPENFLOW_SNOWDON", `${THIS_FILE}.does-not-exist.bos`);
    expect(snowdonPath()).toBeUndefined();
  });
});

describe("withSnowdonPlaceholder", () => {
  const args = ["--host", "h", "--outline", "o.json"];

  it("appends the model as --placeholder SNOWDON=<path>", () => {
    expect(withSnowdonPlaceholder(args, "C:/m/s.bos")).toEqual([...args, "--placeholder", "SNOWDON=C:/m/s.bos"]);
  });

  it("keeps a SNOWDON the command line already gives", () => {
    const given = [...args, "--placeholder", "SNOWDON=C:/other.bos"];
    expect(withSnowdonPlaceholder(given, "C:/m/s.bos")).toEqual(given);
  });

  it("adds nothing when no model is found", () => {
    expect(withSnowdonPlaceholder(args, undefined)).toEqual(args);
  });
});
