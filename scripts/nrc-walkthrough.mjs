// The NRC walkthrough: builds the host and the IFC MCP server, then runs the paper's
// demonstration end to end on two models and writes every figure and transcript
// under one output folder with a Markdown index.
//
//   Duplex (public, IFC):  the seeded nrc-* graphs captured as figures (storey chart and
//                          table, property values, three 3D colourings, DC-W1 verdicts,
//                          storey walk), then the IFC MCP replay of four questions.
//   Snowdon (private, BOS): the view3d recipe graph captured as figures, then the
//                          DuckDB workflows over the Snowdon export on a tables host,
//                          then the dataflow MCP replay that builds a door schedule.
//
//   node scripts/nrc-walkthrough.mjs [--out artifacts/nrc-walkthrough] [--no-build]
//                                    [--skip-duplex] [--skip-snowdon] [--skip-mcp]
//
// Snowdon runs only when the model is present: BIMOPENFLOW_SNOWDON or
// Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos for the 3D part,
// artifacts/building-model-workflows/snowdon-cli.duckdb for the DuckDB part.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildProject, randomPort, root, startHost, startWeb, stop, waitForAnalysisOk, waitForUrl } from "./bim-flow-processes.mjs";
import { captureAll, launchBrowser } from "./capture-bim-flow.mjs";

const flag = (name) => process.argv.includes(name);
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const out = resolve(root, arg("--out", "artifacts/nrc-walkthrough"));
const build = join(out, "build");
const hostDll = join(build, "host", "bimopenflow-host.dll");
const ifcMcpDll = join(build, "ifc-mcp", "bimopenmcp-ifc.dll");
const flowMcpDll = join(build, "flow-mcp", "bimopenmcp-flow.dll");
const snowdonBos = process.env.BIMOPENFLOW_SNOWDON
  ?? join(homedir(), "Documents", "BIM Open Schema", "Snowdon Towers Sample Architectural.bos");
const snowdonDatabase = join(root, "artifacts", "building-model-workflows", "snowdon-cli.duckdb");

// [analysis, node, pane, file, caption]; every id is seeded by the bim host from samples/nrc-analyses.
const DUPLEX_CAPTURES = [
  ["nrc-storey-carbon-chart", "answer", "chart", "figure-2-storey-carbon-chart.png",
    "Figure 2. Embodied and operational carbon per storey (synthetic values) as a bar chart from a chart.bar node over the storey CSV."],
  ["nrc-storey-carbon-chart", "answer", "table", "figure-3-storey-carbon-table.png",
    "Figure 3. The same aggregates in the Table tab."],
  ["nrc-property-values", "answer", "table", "figure-4-property-values-table.png",
    "Figure 4. The 2,438 rows the byte-exact writer turned into IFCPROPERTYSINGLEVALUE entities."],
  ["nrc-color-operational-carbon", "answer", "view3d", "figure-5-3d-operational-carbon.png",
    "Figure 5. duplex-enriched.ifc coloured by operational carbon (viridis, normalised over the column); instances without a value are grey."],
  ["nrc-color-embodied-carbon", "answer", "view3d", "figure-6-3d-embodied-carbon.png",
    "Figure 6. The same model coloured by embodied carbon A1-A3; the roof has no value and stays grey."],
  ["nrc-color-category", "answer", "view3d", "figure-7-3d-category.png",
    "Figure 7. One colour per analysis category (category10 palette, nine categories)."],
  ["nrc-dc-w1-verdicts", "coloured", "view3d", "figure-8-3d-dc-w1-verdicts.png",
    "Figure 8. Rule DC-W1 (door leaf width at least 850 mm) evaluated by check.rule over the model's own OverallWidth, 8 pass and 6 fail, coloured on the doors."],
  ["nrc-dc-w1-verdicts", "answer", "verdict", "figure-9-dc-w1-verdict-table.png",
    "Figure 9. The verdict table behind Figure 8: one row per door with the width read and the citation."],
  ["nrc-storey-of-element", "answer", "table", "figure-10-storey-of-element.png",
    "Figure 10. Elements per storey from the StoreyOfEntity view, which walks ContainedIn, PartOf, and MemberOf: Level 1 has 103, the count the hand-driven session missed."],
  ["nrc-color-operational-carbon", "answer", "view3d", "figure-13-picked-element-properties.png",
    "Figure 13. A picked wall: the 3D pane lists its property sets, including the Pset_NRC sets the enrichment wrote.", [0.5, 0.55]],
];

const SNOWDON_CAPTURES = [
  ["snowdon-toolkit", "categories", "view3d", "snowdon-1-categories.png", "Snowdon Towers coloured by category through view3d.categoryStyle."],
  ["snowdon-toolkit", "cutaway", "view3d", "snowdon-2-cutaway.png", "A horizontal section (view3d.section) through the same model."],
  ["snowdon-toolkit", "exploded", "view3d", "snowdon-3-exploded.png", "Categories fanned apart (view3d.explode)."],
  ["snowdon-toolkit", "plan", "view3d", "snowdon-4-plan.png", "Plan projection (view3d.projection) of the sectioned model."],
];

const DUCKDB_CAPTURES = [
  ["duckdb-door-schedule", null, "table", "snowdon-5-door-schedule.png", "The Snowdon door schedule: two duck.query nodes, a join, and a sort over the typed DuckDB export."],
  ["duckdb-room-distribution", null, "table", "snowdon-6-room-distribution.png", "Rooms per storey from the same export."],
];

const spec = ([analysis, node, pane, file, caption, pick], page = "3d.html") =>
  ({ page, analysis, node: node ?? undefined, pane, file, caption, pick });

const sections = [];
const section = (title, lines) => sections.push(`## ${title}`, "", ...lines, "");

function run(script, args, env = {}) {
  const result = spawnSync("node", [join(root, "scripts", script), ...args], { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  return result.status === 0;
}

async function duplex(browser) {
  const dir = join(out, "duplex");
  const work = mkdtempSync(join(tmpdir(), "nrc-walkthrough-duplex-"));
  const hostPort = randomPort(5400), webPort = randomPort(5800);
  const hostUrl = `http://127.0.0.1:${hostPort}`, webUrl = `http://127.0.0.1:${webPort}`;
  const host = startHost(hostDll, { port: hostPort, profile: "bim", models: [join(root, "samples", "nrc")], work, prefix: "bim-host" });
  let web;
  try {
    await waitForUrl(`${hostUrl}/api/models`, host, { label: "bim host" });
    console.log("Waiting for the Duplex database and BOS to be prepared...");
    await waitForAnalysisOk(hostUrl, "nrc-dc-w1-verdicts");
    await waitForAnalysisOk(hostUrl, "nrc-color-category");
    web = startWeb(webPort, hostUrl, { prefix: "bim-web" });
    await waitForUrl(`${webUrl}/3d.html`, web, { label: "editor" });
    const { results, errors } = await captureAll(browser, webUrl, DUPLEX_CAPTURES.map((c) => spec(c)), dir,
      { title: "Duplex figures" });
    section("Duplex: figures", [
      `Host: bim profile over samples/nrc (${results.length} captures in duplex/, index in duplex/index.md).`, "",
      ...results.map((r) => `- [${r.file}](duplex/${r.file}): ${r.caption}${r.status ? ` (${r.status})` : ""}`),
      ...(errors.length ? ["", `Page errors: ${errors.length}`] : []),
    ]);
  } finally {
    stop(web); stop(host);
    try { rmSync(work, { recursive: true, force: true }); } catch { /* the host may still hold a lock */ }
  }
  if (!flag("--skip-mcp")) {
    const transcript = join(dir, "transcript-ifc-mcp-replay.md");
    const ok = run("demo-ifc-mcp.mjs", ["--dll", ifcMcpDll, "--out", transcript]);
    section("Duplex: MCP connectivity", [
      `The IFC MCP server over stdio, four of the paper's questions answered by ifc_sql over the text views: ${ok ? "PASS" : "FAIL"}.`,
      `Transcript: [duplex/transcript-ifc-mcp-replay.md](duplex/transcript-ifc-mcp-replay.md).`, "",
      "For an unattended language-model run of the full question list, see `bimopenmcp-ifc-ask` (src/studio/BimOpenMcp.Ifc.Ask).",
    ]);
  }
}

async function snowdon3d(browser) {
  if (!existsSync(snowdonBos)) { section("Snowdon: 3D", [`Skipped: ${snowdonBos} not found.`]); return; }
  const dir = join(out, "snowdon");
  const work = mkdtempSync(join(tmpdir(), "nrc-walkthrough-snowdon-"));
  const hostPort = randomPort(5400), webPort = randomPort(5800);
  const hostUrl = `http://127.0.0.1:${hostPort}`, webUrl = `http://127.0.0.1:${webPort}`;
  const host = startHost(hostDll, { port: hostPort, profile: "bim", models: [join(root, "samples", "nrc")], work,
    prefix: "snowdon-host", env: { BIMOPENFLOW_SNOWDON: snowdonBos } });
  let web;
  try {
    await waitForUrl(`${hostUrl}/api/models`, host, { label: "bim host" });
    await waitForAnalysisOk(hostUrl, "snowdon-toolkit");
    web = startWeb(webPort, hostUrl, { prefix: "snowdon-web" });
    await waitForUrl(`${webUrl}/3d.html`, web, { label: "editor" });
    const { results } = await captureAll(browser, webUrl, SNOWDON_CAPTURES.map((c) => spec(c)), dir, { title: "Snowdon 3D figures" });
    section("Snowdon: 3D recipes", [
      `The private Snowdon Towers BOS through samples/snowdon-analyses/snowdon-toolkit.json (${results.length} captures in snowdon/).`, "",
      ...results.map((r) => `- [${r.file}](snowdon/${r.file}): ${r.caption}${r.status ? ` (${r.status})` : ""}`),
    ]);
  } finally {
    stop(web); stop(host);
    try { rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

async function snowdonDuckDb(browser) {
  if (!existsSync(snowdonDatabase)) { section("Snowdon: DuckDB", [`Skipped: ${snowdonDatabase} not found.`]); return; }
  const dir = join(out, "snowdon");
  const work = mkdtempSync(join(tmpdir(), "nrc-walkthrough-duckdb-"));
  const store = join(work, "store");
  await mkdir(store, { recursive: true });
  if (!run("prepare-bim-flow-duckdb.mjs", [snowdonDatabase, store])) throw new Error("preparing the DuckDB demo store failed");
  const hostPort = randomPort(5400), webPort = 5308; // vite.duckdb.config.ts pins its port
  const hostUrl = `http://127.0.0.1:${hostPort}`, webUrl = `http://127.0.0.1:${webPort}`;
  const host = startHost(hostDll, { port: hostPort, profile: "tables", models: [join(root, "artifacts", "building-model-workflows")], work, prefix: "tables-host" });
  let web;
  try {
    await waitForUrl(`${hostUrl}/api/models`, host, { label: "tables host" });
    await waitForAnalysisOk(hostUrl, "duckdb-door-schedule");
    web = startWeb(webPort, hostUrl, { prefix: "duckdb-web", config: "vite.duckdb.config.ts" });
    await waitForUrl(`${webUrl}/duckdb.html`, web, { label: "duckdb page" });
    const { results } = await captureAll(browser, webUrl, DUCKDB_CAPTURES.map((c) => spec(c, "duckdb.html")), dir, { title: "Snowdon DuckDB figures" });
    section("Snowdon: DuckDB workflows", [
      `The tables host over the Snowdon typed export (${results.length} captures in snowdon/).`, "",
      ...results.map((r) => `- [${r.file}](snowdon/${r.file}): ${r.caption}`),
    ]);
  } finally {
    stop(web); stop(host);
  }
  if (!flag("--skip-mcp")) {
    const ok = run("demo-bim-flow-mcp.mjs", [], {
      BOF_MCP_DLL: flowMcpDll, BOF_DUCKDB_STORE: store,
      BOF_DUCKDB_MODELS: join(root, "artifacts", "building-model-workflows"), BOF_DUCKDB: snowdonDatabase,
    });
    section("Snowdon: MCP connectivity", [
      `The dataflow MCP server over stdio builds and evaluates a door-schedule graph from tool calls alone: ${ok ? "PASS (142 doors)" : "FAIL"}.`,
    ]);
  }
  try { rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
}

await mkdir(out, { recursive: true });
if (!flag("--no-build")) {
  buildProject("src/flow/BimOpenFlow.Host", join(build, "host"));
  if (!flag("--skip-mcp")) {
    buildProject("src/mcp/BimOpenMcp.Ifc", join(build, "ifc-mcp"));
    if (!flag("--skip-snowdon")) buildProject("src/mcp/BimOpenMcp.Flow", join(build, "flow-mcp"));
  }
}

const started = Date.now();
const browser = await launchBrowser();
let failed = false;
try {
  if (!flag("--skip-duplex")) await duplex(browser);
  if (!flag("--skip-snowdon")) { await snowdon3d(browser); await snowdonDuckDb(browser); }
} catch (error) {
  failed = true;
  section("Failure", [String(error.stack ?? error)]);
  console.error(error);
} finally {
  await browser.close();
}

const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).stdout?.trim();
await writeFile(join(out, "README.md"), [
  "# NRC walkthrough output", "",
  `Generated ${new Date().toISOString()} by scripts/nrc-walkthrough.mjs at toolkit commit ${commit ?? "unknown"} in ${Math.round((Date.now() - started) / 1000)} s.`,
  "Duplex first (public IFC, synthetic analytics), then Snowdon (private BOS and DuckDB export). See docs/nrc-walkthrough.md for the narrative.", "",
  ...sections,
].join("\n"));
console.log(`\nIndex: ${join(out, "README.md")}`);
if (failed) process.exitCode = 1;
