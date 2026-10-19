import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The web packages this workspace takes from deps/ (see deps.json): bim-open-flow's eight
// editor packages, and bim-open-notebook's notebook and 3D pane. They resolve to their
// source, as the viewer's do (viewer.config.ts), so no stale build is read. Their own imports
// of each other are aliased too, because a file reached through the node_modules link
// resolves its imports from its real path in deps/, where this workspace's node_modules is
// not on the way up. The aliases are read from each package's package.json (main and
// exports), so a new export needs no change here; a deep import such as
// @bimopenflow/graph/scripts/sampleGraphs.js reaches the .ts file beside it.
// deps.tsconfig.json carries the same mapping for tsc.

interface Manifest {
  readonly name: string;
  readonly main?: string;
  readonly exports?: Readonly<Record<string, string>>;
}

export interface Alias {
  readonly find: RegExp;
  readonly replacement: string;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** The aliases for every package in `dir`, a packages folder given relative to this
 *  workspace (bimopenflow/web): one exact alias per export of each package (with "." from
 *  main when there is no exports map), then one per package for deep imports of a .js path
 *  that is a .ts file. */
export function packagesAlias(dir: string): Alias[] {
  const packagesDir = fileURLToPath(new URL(dir.replace(/\/?$/, "/"), import.meta.url));
  const manifests = readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      dir: `${packagesDir}${d.name}/`,
      manifest: JSON.parse(readFileSync(`${packagesDir}${d.name}/package.json`, "utf8")) as Manifest,
    }));
  return [
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
}

/** The third-party dependencies (not @bimopenflow/ or @bim-open-viewer/ packages) of every package
 *  in the packages folders given relative to this workspace, sorted. A file of a linked package
 *  resolves these from its real path in deps/, where no node_modules exists on a clean checkout
 *  (the NRC Pages runner failed on vega-embed this way), so the page configs list them in
 *  resolve.dedupe, which resolves them from this workspace, and package.json installs them. */
export function linkedDependencies(...dirs: string[]): string[] {
  const names = new Set<string>();
  for (const dir of dirs) {
    const packagesDir = fileURLToPath(new URL(dir.replace(/\/?$/, "/"), import.meta.url));
    for (const d of readdirSync(packagesDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const manifest = JSON.parse(readFileSync(`${packagesDir}${d.name}/package.json`, "utf8")) as { dependencies?: Record<string, string> };
      for (const name of Object.keys(manifest.dependencies ?? {}))
        if (!name.startsWith("@bimopenflow/") && !name.startsWith("@bim-open-viewer/")) names.add(name);
    }
  }
  return [...names].sort();
}

/** bim-open-flow's editor packages (api-client, app, client, contracts, graph, panes, state, viz). */
export const flowAlias = packagesAlias("../../deps/bim-open-flow/bimopenflow/web/packages");

/** bim-open-notebook's packages: the notebook and the 3D pane. */
export const notebookAlias = packagesAlias("../../deps/bim-open-notebook/bimopenflow/web/packages");

/** The third-party dependencies of the linked packages above, for resolve.dedupe in the page configs. */
export const linkedDeps = linkedDependencies(
  "../../deps/bim-open-flow/bimopenflow/web/packages",
  "../../deps/bim-open-notebook/bimopenflow/web/packages",
);
