// Builds the two MCP servers into the folders .mcp.json points at, then checks that every
// dll named in .mcp.json exists, so a Claude Code session in this repository connects to
// both servers on its first launch. `--check` skips the build and only reports.
//
//   node scripts/build-mcp.mjs [--check]
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { root, buildProject } from "./bim-flow-processes.mjs";

const SERVERS = [
  { project: "src/mcp/BimOpenMcp.Flow", output: "artifacts/bim-flow-duckdb/mcp" },
  { project: "src/mcp/BimOpenMcp.Ifc", output: "artifacts/bim-flow-ifc/mcp" },
];

/** The dll each `dotnet <dll>` server entry in an .mcp.json launches, keyed by server name. */
export function serverDlls(mcpJson) {
  return Object.entries(mcpJson.mcpServers ?? {})
    .filter(([, s]) => s.command === "dotnet" && s.args?.[0]?.endsWith(".dll"))
    .map(([name, s]) => ({ name, dll: s.args[0] }));
}

/** Names the servers whose dll is missing under `base`. */
export function missingServers(mcpJson, base) {
  return serverDlls(mcpJson).filter(({ dll }) => !existsSync(resolve(base, dll)));
}

const checkOnly = process.argv.includes("--check");
if (!checkOnly)
  for (const { project, output } of SERVERS) buildProject(project, resolve(root, output));

const config = JSON.parse(readFileSync(resolve(root, ".mcp.json"), "utf8"));
const missing = missingServers(config, root);
for (const { name, dll } of serverDlls(config))
  console.log(`${missing.some((m) => m.name === name) ? "MISSING" : "OK     "} ${name}: ${dll}`);
if (missing.length > 0) {
  console.error(`${missing.length} MCP server(s) will not start. Run: node scripts/build-mcp.mjs`);
  process.exit(1);
}
