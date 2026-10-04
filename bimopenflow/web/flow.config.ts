import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The editor's generic packages come from bim-open-flow (deps/bim-open-flow, see deps.json):
// they resolve to their source, as the viewer's do (viewer.config.ts), so no stale build is
// read. Their own imports of each other are aliased too, because a file reached through the
// node_modules link resolves its imports from its real path in deps/, where this workspace's
// node_modules is not on the way up. The aliases are read from each package's package.json
// (main and exports), so a new export needs no change here; a deep import such as
// @bimopenflow/graph/scripts/sampleGraphs.js reaches the .ts file beside it.
// deps.tsconfig.json carries the same mapping for tsc.

const packagesDir = fileURLToPath(new URL("../../deps/bim-open-flow/bimopenflow/web/packages/", import.meta.url));

interface Manifest {
  readonly name: string;
  readonly main?: string;
  readonly exports?: Readonly<Record<string, string>>;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const manifests: { dir: string; manifest: Manifest }[] = readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => ({ dir: `${packagesDir}${d.name}/`, manifest: JSON.parse(readFileSync(`${packagesDir}${d.name}/package.json`, "utf8")) as Manifest }));

/** One exact alias per export of every package (with "." from main when there is no
 *  exports map), then one per package for deep imports of a .js path that is a .ts file. */
export const flowAlias = [
  ...manifests.flatMap(({ dir, manifest }) =>
    Object.entries(manifest.exports ?? { ".": manifest.main ?? "./src/index.ts" }).map(([key, target]) => ({
      find: new RegExp(`^${escape(manifest.name + key.slice(1))}$`),
      replacement: dir + target.replace(/^\.\//, ""),
    }))),
  ...manifests.map(({ dir, manifest }) => ({
    find: new RegExp(`^${escape(manifest.name)}/(.+)\\.js$`),
    replacement: `${dir}$1.ts`,
  })),
];
