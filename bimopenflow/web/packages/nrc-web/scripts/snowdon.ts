/// <reference types="node" />
// The toolkit's private Snowdon model, which the sample outlines name as
// {SNOWDON}. write-sample-notebooks.ts adds it to the notebook script's
// command line, which knows no model of its own.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * BIMOPENFLOW_SNOWDON when it names an existing file, else the default
 * location when that exists, else undefined. Duplicates
 * BimSampleSeeding.SnowdonPath in the host, which fills the same placeholder
 * only when it seeds an empty store, never on a PUT (plan, Debt).
 */
export function snowdonPath(): string | undefined {
  const fromEnv = process.env.BIMOPENFLOW_SNOWDON;
  const path =
    fromEnv && fromEnv.length > 0
      ? fromEnv
      : join(homedir(), "Documents", "BIM Open Schema", "Snowdon Towers Sample Architectural.bos");
  return existsSync(path) ? path : undefined;
}

/**
 * `args` with `--placeholder SNOWDON=<path>` appended, unless they already
 * give SNOWDON or `path` (snowdonPath()'s answer) is undefined.
 */
export function withSnowdonPlaceholder(args: readonly string[], path: string | undefined): string[] {
  const given = args.some((arg, i) => arg === "--placeholder" && args[i + 1]?.startsWith("SNOWDON="));
  return given || path === undefined ? [...args] : [...args, "--placeholder", `SNOWDON=${path}`];
}
