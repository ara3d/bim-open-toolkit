/// <reference types="node" />
// The seam both packages bound for ara3d/bim-open-notebook keep: the notebook
// (bim-open-notebook) and this pane. Neither may import BIM Open Toolkit's
// editor application or pages, nor name the toolkit's private samples, so the
// two packages build in their new repository with no toolkit beside them.
// seam.test.ts here and in the notebook package call seamOffences; this module
// is the one place the rules live. Not a test file itself (no .test suffix).

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/** Import specifiers that reach the toolkit: its editor application, its pages, or its NRC pages, by name or by relative path. */
const TOOLKIT_IMPORTS: readonly RegExp[] = [/^@bimopenflow\/app(\/|$)/, /studio-web/, /nrc-web/];

/** Strings that name the toolkit's samples or its private Snowdon model. */
const TOOLKIT_NAMES: readonly string[] = ["samples/nrc-analyses", "{SNOWDON}", "BIMOPENFLOW_SNOWDON"];

const CODE = /\.(ts|tsx|js|mjs|cjs)$/;
const TEXT = /\.(ts|tsx|js|mjs|cjs|json|html|md|css|svg)$/;
const SKIPPED_FOLDERS = new Set(["node_modules", "dist", ".vite"]);

/** Every import or export specifier in a source file, static or dynamic. */
export function specifiers(source: string): string[] {
  return [...source.matchAll(/\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);
}

function textFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? SKIPPED_FOLDERS.has(entry.name) ? [] : textFiles(join(dir, entry.name))
      : TEXT.test(entry.name) ? [join(dir, entry.name)] : []);
}

/**
 * Each file under `packageDir` (a package folder) that imports the toolkit
 * or names its samples, or imports a specifier `alsoForbidden` matches, as
 * "<file> -> <what>". `exempt` lists files, relative to `packageDir`, that may
 * name the rules (this module and the seam tests that call it).
 */
export function seamOffences(packageDir: string, options: { alsoForbidden?: readonly RegExp[]; exempt?: readonly string[] } = {}): string[] {
  const forbidden = [...TOOLKIT_IMPORTS, ...(options.alsoForbidden ?? [])];
  const exempt = new Set((options.exempt ?? []).map((f) => f.replace(/\\/g, "/")));
  const offences: string[] = [];
  for (const file of textFiles(packageDir)) {
    const name = relative(packageDir, file).replace(/\\/g, "/");
    if (exempt.has(name)) continue;
    const text = readFileSync(file, "utf8");
    if (CODE.test(file))
      for (const spec of specifiers(text)) if (forbidden.some((f) => f.test(spec))) offences.push(`${name} -> import ${spec}`);
    for (const named of TOOLKIT_NAMES) if (text.includes(named)) offences.push(`${name} -> names ${named}`);
  }
  return offences;
}
