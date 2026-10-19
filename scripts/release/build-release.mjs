// Builds the Windows release (TKT-322) into one self-contained folder, and zips it.
//
//   node scripts/release/build-release.mjs [--version 0.1.0] [--out artifacts/release]
//        [--skip-dotnet] [--skip-web] [--no-zip] [--reuse-dotnet] [--reuse-web]
// --reuse-dotnet and --reuse-web assemble the folder from the publishes or the web builds of the last run (work/), without rebuilding them.
//
// The folder, artifacts/release/BimOpenToolkit-<version>-win-x64/, holds:
//   bimopen.exe          the wizard and launcher (setup, doctor, start, stop)
//   BimOpenToolkit.sln   an empty marker: the host finds the folder holding samples/ by looking up
//                        from its executable for a solution file (SampleSeeding.FindRepoRoot)
//   bin/                 the studio host, the IFC and dataflow MCP servers, the Ask runner, ifc-to-bos,
//                        one .NET runtime between them (no SDK needed on the user's machine)
//   web/                 the built studio and notebook pages the host serves, with the notebooks at
//                        /__notebooks/ and the graph list at /__nrc/graphs.md
//   samples/, skills/, docs/, licenses/
// The release smoke (smoke-release.mjs) runs next, on the folder, before it is zipped.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { basename } from "node:path";
import { capture, clean, copyInto, copyTracked, filesUnder, megabytes, mergeTree, root, run, sizeOf } from "./lib.mjs";
import { LAUNCHER, PUBLISHED } from "./projects.mjs";
import { bundledNpmPackages, writeNotices } from "./notices.mjs";

const flag = (name) => process.argv.includes(name);
const option = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const sha = capture("git", ["rev-parse", "--short=10", "HEAD"]) ?? "unknown";
const version = option("--version", `0.0.0-dev.${sha}`);
const outRoot = resolve(root, option("--out", "artifacts/release"));
const name = `BimOpenToolkit-${version}-win-x64`;
const layout = join(outRoot, name);
const work = join(outRoot, "work");
let npmNames = [];
const reuseDotnet = flag("--reuse") || flag("--reuse-dotnet");
const reuseWeb = flag("--reuse") || flag("--reuse-web");
const webProject = (pkg, args = [], env = {}) =>
  run("npm", ["run", pkg.script, "-w", pkg.name, "--prefix", "bimopenflow/web", "--", ...args], { env });

/** Publishes every project self-contained into its own folder and merges them into bin/, refusing a disagreement. */
function publishBinaries() {
  const bin = join(layout, "bin");
  for (const project of PUBLISHED) {
    const stage = join(work, "publish", project.name);
    if (!reuseDotnet) clean(stage);
    if (!reuseDotnet) run("dotnet", ["publish", project.path, "-c", "Release", "-r", "win-x64", "--self-contained",
      ...(option("--version") ? [`-p:Version=${version.replace(/-.*$/, "")}`] : []),
      "--artifacts-path", join(outRoot, "build"), "-nodeReuse:false", "--nologo", "-v:q", "-o", stage]);
    const conflicts = mergeTree(stage, bin, (file) => file.endsWith(".pdb"));
    if (conflicts.length > 0)
      throw new Error(`${project.name} publishes files that differ from an earlier project's: ${conflicts.join(", ")}`);
  }
}

/** Publishes the launcher as one self-contained file at the top of the release folder. */
function publishLauncher() {
  const stage = join(work, "publish", "launcher");
  if (!reuseDotnet) clean(stage);
  if (!reuseDotnet) run("dotnet", ["publish", LAUNCHER, "-c", "Release", "-r", "win-x64", "--self-contained", "-p:PublishSingleFile=true",
    "-p:EnableCompressionInSingleFile=true", "--artifacts-path", join(outRoot, "build"), "-nodeReuse:false", "--nologo", "-v:q", "-o", stage]);
  copyInto(join(stage, "bimopen.exe"), join(layout, "bimopen.exe"));
}

/** Builds the live studio and notebook pages, and the static notebook site whose notebooks the live page lists. */
function buildWeb() {
  const staged = join(work, "web");
  const studio = join(staged, "studio");
  const nrc = join(staged, "nrc");
  if (!reuseWeb) clean(staged);
  if (!reuseWeb) webProject({ script: "build", name: "@bimopenflow/studio-web" }, ["--outDir", studio, "--emptyOutDir", "--sourcemap"]);
  // VITE_BOF_EDITOR=/ makes the notebook's "open in the editor" links point at this host's own editor page.
  if (!reuseWeb) webProject({ script: "build", name: "@bimopenflow/nrc-web" }, ["--outDir", nrc, "--emptyOutDir", "--sourcemap"], { VITE_BOF_EDITOR: "/" });
  if (!reuseWeb) webProject({ script: "build:pages", name: "@bimopenflow/nrc-web" });

  // The source maps name every npm package the pages bundle, for the notices; they do not ship.
  npmNames = bundledNpmPackages([studio, nrc]);
  // Both builds ship a favicon.svg, and they differ (the notebook has its own mark): the notebook pages keep theirs under another name.
  if (existsSync(join(nrc, "favicon.svg"))) renameSync(join(nrc, "favicon.svg"), join(nrc, "notebook-favicon.svg"));
  for (const page of ["nrc.html", "notebook.html"])
    writeFileSync(join(nrc, page), readFileSync(join(nrc, page), "utf8").replace(/href="(\.?\/?)favicon\.svg"/, 'href="$1notebook-favicon.svg"'));
  const web = join(layout, "web");
  for (const folder of [studio, nrc]) {
    const conflicts = mergeTree(folder, web, (file) => file.endsWith(".map"));
    if (conflicts.length > 0) throw new Error(`The studio and notebook builds disagree about: ${conflicts.join(", ")}`);
  }
  const site = join(root, "artifacts", "nrc-site");
  for (const file of filesUnder(join(site, "notebooks")).filter((f) => f !== "node-catalog.json" && f !== "catalog.json"))
    copyInto(join(site, "notebooks", file), join(web, "__notebooks", file));
  copyInto(join(site, "graphs.md"), join(web, "__nrc", "graphs.md"));
  copyInto(join(site, "NOTICE.md"), join(web, "NOTICE.md"));
}

/** The samples the release carries: tracked files only, so run output and private models stay out. */
function copySamples() {
  const samples = [
    "nrc", "notebooks", "nrc-analyses", "checking-analyses", "bim", "bim-analyses", "view3d-analyses", "viz-analyses",
    "showcase-analyses", "showcase-tables",
  ].map((folder) => `samples/${folder}`);
  copyTracked(root, samples, layout);
  // The notebooks that stay out, as on the public site: Snowdon's model is private, and the owner kept s11 off.
  for (const omitted of ["s10-snowdon", "s11-editing-history"])
    for (const file of filesUnder(join(layout, "samples", "notebooks")).filter((f) => f.includes(omitted)))
      clean(join(layout, "samples", "notebooks", file));
  copyTracked(join(root, "deps", "bim-open-flow"), ["samples/tables"], layout);
  copyTracked(join(root, "deps", "bim-open-data"), ["samples/public"], layout);
  for (const folder of ["bim-flow", "ifc-ask"]) copyTracked(root, [`.claude/skills/${folder}`], join(layout, "skills"), ".claude/skills/");
  copyTracked(root, ["docs/nodes.md", "docs/nodes.catalog.json"], layout);
}

const SKILL_NOTE = `

## In the Windows release

\`bimopen setup\` registered the servers named above in Claude Code, so there is nothing to build: ignore the instructions
above about \`.mcp.json\`, \`node scripts/build-mcp.mjs\`, and paths under \`deps/\`. The sample models are in the \`samples\` folder of the
release (\`samples/nrc/duplex-enriched.ifc\` is the Duplex apartment with the NRC property sets). \`bimopen doctor\` says what is wrong
when a tool does not answer.
`;

/** Tells each installed skill that the release has registered its server already. */
function annotateSkills() {
  for (const skill of ["bim-flow", "ifc-ask"]) {
    const file = join(layout, "skills", skill, "SKILL.md");
    writeFileSync(file, readFileSync(file, "utf8").trimEnd() + SKILL_NOTE);
  }
}

function writeManifest() {
  writeFileSync(join(layout, "BimOpenToolkit.sln"), "");
  const pins = JSON.parse(readFileSync(join(root, "deps.json"), "utf8"));
  const manifest = {
    version, commit: capture("git", ["rev-parse", "HEAD"]), builtAt: new Date().toISOString(),
    dependencies: Object.fromEntries(Object.entries(pins).map(([k, v]) => [k, v.commit])),
  };
  writeFileSync(join(layout, "README.txt"), [
    `BIM Open Toolkit ${version} for Windows`,
    "",
    "1. Double-click bimopen.exe (or run: bimopen setup). It checks this computer, connects the toolkit to your own",
    "   Claude Code, and tests that everything works.",
    "2. bimopen start    opens the NRC notebooks in your browser;  bimopen stop  stops the host.",
    "3. bimopen doctor   runs every check again and says how to fix what is wrong.",
    "",
    "Nothing here needs an administrator, .NET, Node, or git. Claude Code is the one thing to install first:",
    "https://code.claude.com/docs/en/setup",
    "",
  ].join("\r\n"));
  writeFileSync(join(layout, "release.json"), JSON.stringify(manifest, null, 2) + "\n");
}

clean(layout);
mkdirSync(layout, { recursive: true });
if (!flag("--skip-dotnet")) {
  publishBinaries();
  publishLauncher();
}
if (!flag("--skip-web")) buildWeb();
copySamples();
annotateSkills();
const noticed = writeNotices(layout, root, {
  buildDir: join(outRoot, "build"),
  projects: [...PUBLISHED.map((p) => basename(p.path)), basename(LAUNCHER)],
  npmNames,
  npmRoots: ["node_modules", "bimopenflow/web/node_modules", "deps/bim-open-viewer/node_modules", "deps/bim-open-notebook/bimopenflow/web/node_modules",
    "deps/bim-open-flow/bimopenflow/web/node_modules", ...["studio-web", "nrc-web", "app"].map((p) => `bimopenflow/web/packages/${p}/node_modules`)]
    .map((p) => join(root, p)),
});
console.log(`notices: ${noticed.runtime} runtime packs, ${noticed.nuget} NuGet packages, ${noticed.npm} npm packages`);
writeManifest();
console.log(`\nlayout: ${layout} (${megabytes(sizeOf(layout))})`);
if (!flag("--no-zip")) {
  const zip = join(outRoot, `${name}.zip`);
  clean(zip);
  // Windows' own bsdtar writes zips; the tar that Git for Windows puts first on PATH does not.
  run(join(process.env.SystemRoot ?? "C:/Windows", "System32", "tar.exe"), ["-a", "-c", "-f", zip, "-C", outRoot, name]);
  console.log(`zip: ${zip}`);
}
