// @vitest-environment node
// The toolkit's own sample graphs (TKT-110, TKT-125): every kind they use is
// in the studio's committed catalog (docs/nodes.catalog.json, every pack), no
// two cards overlap as the page that loads them shows them, and no text a card
// paints runs past its edges. The graph package checks its
// own samples (samples/analyses, relations, tables, in bim-open-flow) against
// the generic catalog; this covers this repository's samples/: the BIM, NRC, Snowdon,
// showcase, view3d, and notebook graphs. On an overlap, relay out with
//   npm run relayout-samples --prefix deps/bim-open-flow/bimopenflow/web/packages/graph -- --root <toolkit> --catalog docs/nodes.catalog.json --samples <dirs>
// (after npm ci --prefix deps/bim-open-flow/bimopenflow/web)

import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { committedCatalog, overlappingPairs, sampleGraphs, shownModel, unknownKinds } from "@bimopenflow/graph/scripts/sampleGraphs.js";
import { catalogOverflows, sampleOverflows } from "@bimopenflow/graph/scripts/cardOverflow.js";

const toolkit = fileURLToPath(new URL("../../../../../", import.meta.url));

import { TOOLKIT_SAMPLE_DIRS } from "./sampleDirs.js";

const catalog = committedCatalog(join(toolkit, "docs", "nodes.catalog.json"));
const samples = sampleGraphs(TOOLKIT_SAMPLE_DIRS, toolkit);


it("finds the toolkit's sample graphs", () => {
  // 71 graphs in these folders when this was written.
  expect(samples.length).toBeGreaterThanOrEqual(70);
});

it("every kind a sample graph uses is in the studio's catalog", () => {
  const unknown = samples.flatMap((s) => unknownKinds(s.document, catalog).map((k) => `${s.name}: ${k}`));
  expect(unknown).toEqual([]);
});

it("no sample graph has overlapping node cards", () => {
  const report = samples.flatMap((sample) => {
    const pairs = overlappingPairs(shownModel(sample, catalog));
    return pairs.length ? [`${sample.name}: ${pairs.join(", ")}`] : [];
  });
  expect(report).toEqual([]);
});

// Measuring every card of every sample graph takes about 8 s on an idle machine and over 30 s
// when other builds share it; vitest's 5 s default made the close gate fail on load alone.
const MEASURE_TIMEOUT_MS = 120_000;

describe("no text overflows its card", () => {
  it("for every sample graph as shown and at least width", () => {
    expect(sampleOverflows(samples, catalog)).toEqual([]);
  }, MEASURE_TIMEOUT_MS);

  it("for every catalog kind with default and long values", () => {
    expect([false, true].flatMap((long) => catalogOverflows(catalog, long))).toEqual([]);
  }, MEASURE_TIMEOUT_MS);
});
