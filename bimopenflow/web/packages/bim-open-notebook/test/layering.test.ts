// @vitest-environment node
// The package boundary, enforced: the notebook is a library over the editor's
// shared packages, never over the editor application itself, so it can move to
// its own repository (ara3d/bim-open-notebook). Nothing under src imports
// @bimopenflow/app or reaches out of src by a relative path.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = fileURLToPath(new URL("../src", import.meta.url));

const forbidden = ["@bimopenflow/app"];

/** Every import or export specifier in a TypeScript source, static or dynamic. */
function specifiers(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) out.push(m[1]!);
  return out;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(dir, entry.name))
      : entry.name.endsWith(".ts") ? [join(dir, entry.name)] : []);
}

/** True when a relative specifier from `file` resolves outside src. */
const leavesSrc = (file: string, spec: string): boolean =>
  spec.startsWith(".") && relative(src, resolve(dirname(file), spec)).startsWith("..");

describe("layering", () => {
  it("imports nothing from the editor application or from outside src", () => {
    const offences: string[] = [];
    for (const file of sourceFiles(src)) {
      for (const spec of specifiers(readFileSync(file, "utf8"))) {
        if (leavesSrc(file, spec) || forbidden.some((f) => spec === f || spec.startsWith(`${f}/`)))
          offences.push(`${relative(src, file)} -> ${spec}`);
      }
    }
    expect(offences).toEqual([]);
  });
});
