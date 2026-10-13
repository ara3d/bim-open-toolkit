// @vitest-environment node
// TKT-286: every toolkit sample graph passes the layout and wiring check of the
// graph package (layoutCheck.ts) as the studio and a plain canvas draw it: no
// overlapping cards, no wire behind a card, no wire running backwards, no
// unwired input, no node with no wire, and every position where autoLayout
// puts it (positions come from the tool, never from a hand). The graph package checks its own
// samples the same way. On a failure, list the faults or relay out with
//   npm run layout-report --prefix deps/bim-open-flow/bimopenflow/web/packages/graph -- --root <toolkit> --catalog docs/nodes.catalog.json --samples <dirs>
//   npm run relayout-samples --prefix deps/bim-open-flow/bimopenflow/web/packages/graph -- --root <toolkit> --catalog docs/nodes.catalog.json --samples <dirs>

import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { expect, it } from "vitest";
import { sampleIssues } from "@bimopenflow/graph/scripts/layoutReport.js";
import { committedCatalog, sampleGraphs } from "@bimopenflow/graph/scripts/sampleGraphs.js";
import { TOOLKIT_SAMPLE_DIRS } from "./sampleDirs.js";

const toolkit = fileURLToPath(new URL("../../../../../", import.meta.url));
const catalog = committedCatalog(join(toolkit, "docs", "nodes.catalog.json"));
const samples = sampleGraphs(TOOLKIT_SAMPLE_DIRS, toolkit);

/** Graphs whose wires still pass behind a card after autoLayout, and why. */
const WIRES_BEHIND_CARDS: Readonly<Record<string, string>> = {
  "samples/nrc-analyses/nrc-enrich-run.json": "two sources each feed four steps across three layers; clearing every wire needs wires routed round cards (TKT-287)",
};

const faults = new Map(samples.map((s) => [s.name, sampleIssues(s, catalog)]));

it("no sample graph has a layout or wiring fault", () => {
  const report = [...faults].flatMap(([name, issues]) => {
    const shown = name in WIRES_BEHIND_CARDS ? issues.filter((i) => !i.startsWith("wireBehindCard:")) : issues;
    return shown.length ? [`${name}: ${shown.join("; ")}`] : [];
  });
  expect(report).toEqual([]);
});

it("every graph excused from the wire check still needs it", () => {
  expect(Object.keys(WIRES_BEHIND_CARDS).filter((name) => !faults.get(name)?.length)).toEqual([]);
});
