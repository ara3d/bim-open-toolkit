/// <reference types="node" />
// The toolkit's private Snowdon model, the default for {SNOWDON} when
// write-sample-notebooks.ts is not given --placeholder SNOWDON=<path>. Toolkit
// knowledge, not the notebook's: it leaves this package with the NRC page
// (repository split, phase 6, chunk 6.3).

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
