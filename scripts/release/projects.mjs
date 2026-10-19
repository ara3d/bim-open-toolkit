// The projects the release publishes self-contained into bin/. The studio host brings the dataflow MCP
// server (its `mcp` verb, and bimopenmcp-flow.exe) and the host with it; the others are the IFC MCP
// server, the Ask runner that drives Claude Code, and the converter.
export const PUBLISHED = [
  { name: "studio", path: "src/studio/BimOpenFlow.Studio" },
  { name: "ifc-mcp", path: "deps/bim-open-data/src/mcp/BimOpenMcp.Ifc" },
  { name: "ask", path: "src/studio/BimOpenMcp.Ifc.Ask" },
  { name: "ifc-to-bos", path: "deps/bim-open-data/tools/ifc-to-bos" },
];

/** The wizard and launcher: one self-contained file, bimopen.exe, beside bin/ rather than in it. */
export const LAUNCHER = "src/release/BimOpen.Launcher";
