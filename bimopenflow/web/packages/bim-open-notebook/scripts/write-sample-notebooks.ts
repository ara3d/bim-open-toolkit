/// <reference types="node" />
// Writes one sample notebook from an outline and a running host, so every
// number in a sample comes from a graph. The outline format is documented in
// samples/notebooks/README.md; the reply texts are the outline's, the embeds,
// snapshots, and tool calls are read from the host.
//
// Rerun from bimopenflow/web/packages/bim-open-notebook, against a host of the
// outline's profile (node scripts/start-bim-flow.mjs starts one):
//
//   npx vite-node scripts/write-sample-notebooks.ts -- --host http://127.0.0.1:5224 \
//     --outline ../../../../samples/notebooks/outlines/nrc-eight-questions.outline.json
//
// The notebook is written as <name>.notebook.json in the folder above the
// outline's (outlines/nrc-x.outline.json gives nrc-x.notebook.json), and is
// checked with parseNotebook first. samples/notebooks/README.md gives the
// command for each committed sample and documents the outline format,
// including the extensions for reconstructed sessions (graphs, tools, stale,
// earlier, picture and chart embeds) this script implements.
//
// Each --placeholder NAME=path fills {NAME} in the outline's graphs before
// they are saved, and turns the path back into {NAME} in the written
// notebook. A caller with a private model passes its path this way (the
// toolkit's own pages package wraps this script and adds its model).
// File and picture paths are relative to the outline's git checkout.
//
// An --out DIR option redirects the write to DIR/<name>.notebook.json instead
// of the outline's own folder, for comparing a regeneration without touching
// the committed file.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { ApiClient } from "@bimopenflow/api-client";
import { parseDocument, type GraphDocument } from "@bimopenflow/state";
import { chartEmbedDraft, embedsForAnalysis, graphEmbedDraft, type EmbedDraft } from "../src/ask/reply";
import { NOTEBOOK_EXTENSION, type Embed, type Notebook, type NodeRef, type ToolCall } from "../src/document/format";
import { emptyNotebook, parseNotebook, serializeNotebook } from "../src/document/io";
import { appendTurn } from "../src/document/edits";
import type { NotebookApi } from "../src/embeds/contract";
import { describeSnapshot, snapshotOf, SNAPSHOT_ROWS } from "../src/live/compare";
import {
  expandPlaceholders,
  hidePlaceholders,
  outlineErrors,
  outlineRoot,
  parsePlaceholders,
  withExtras,
  type EmbedSpec,
  type Outline,
  type OutlineTurn,
  type Placeholders,
} from "./outline";

/** Where an outline's paths resolve: its checkout (file and picture embeds) and its placeholders (graphs). */
interface Paths {
  readonly root: string;
  readonly placeholders: Placeholders;
}

/** Lines of a text file kept as a file embed's preview. */
const PREVIEW_LINES = 6;

/** A picture embed's file, inlined as a data: URL, may not exceed this. */
const MAX_PICTURE_BYTES = 400 * 1024;

/** How long a saved graph's nodes get to stop evaluating before waitSettled gives up. */
const SETTLE_TIMEOUT_MS = 30_000;
const SETTLE_POLL_MS = 200;

// --- Building the notebook -------------------------------------------------
// The outline format itself (Outline, OutlineTurn, EmbedSpec, and outlineErrors,
// expandPlaceholders, hidePlaceholders, withExtras) lives in ./outline, so it
// can be unit-tested without a running host; this file adds the host calls.
// Draft/EmbedDraft, the graph embed's draft, and the chart embed's draft are
// ../src/ask/reply's, reused here instead of duplicated (plan, Debt).

/** The analysisId a node-based or auto/graph spec resolves to; undefined for file and picture specs. */
function analysisIdOf(spec: EmbedSpec, turn: OutlineTurn): string | undefined {
  if (spec.kind === "file" || spec.kind === "picture") return undefined;
  return spec.analysisId ?? turn.analysisId;
}

/** analysisIdOf, but throws a message naming the embed when neither the spec nor the turn gives one. */
function requireAnalysisId(spec: EmbedSpec, turn: OutlineTurn, describe: string): string {
  const id = analysisIdOf(spec, turn);
  if (id === undefined) throw new Error(`${describe} needs an analysisId (neither the embed nor the turn has one)`);
  return id;
}

async function draftsFor(spec: EmbedSpec, turn: OutlineTurn, api: NotebookApi, root: string): Promise<EmbedDraft[]> {
  if (spec.kind === "auto") return embedsForAnalysis(requireAnalysisId(spec, turn, "an auto embed"), api);
  if (spec.kind === "graph") {
    const analysisId = requireAnalysisId(spec, turn, "a graph embed");
    return [await graphEmbedDraft(analysisId, api, spec.focus)];
  }
  if (spec.kind === "file") return [fileEmbed(spec, root)];
  if (spec.kind === "picture") return [pictureEmbed(spec, root)];
  const analysisId = requireAnalysisId(spec, turn, `${spec.kind} embed for ${spec.node}.${spec.port}`);
  const source: NodeRef = { analysisId, nodeId: spec.node, port: spec.port };
  const caption = spec.caption ?? `${spec.node}.${spec.port}`;
  if (spec.kind === "view3d") return [{ kind: "view3d", source, caption }];
  const slice = await api.getResult(source.analysisId, source.nodeId, source.port, 0, SNAPSHOT_ROWS);
  const snapshot = snapshotOf(slice);
  if (spec.kind === "table") return [{ kind: "table", source, caption, snapshot }];
  if (spec.kind === "chart") {
    const graph = parseDocument(await api.getAnalysis(analysisId));
    const node = graph.structure.nodes.find((n) => n.id === spec.node);
    return [chartEmbedDraft(source, caption, node?.kind, graph.values[spec.node] ?? {}, snapshot)];
  }
  return [
    {
      kind: "value",
      source,
      caption,
      ...(spec.column !== undefined ? { column: spec.column } : {}),
      ...(spec.unit !== undefined ? { unit: spec.unit } : {}),
      snapshot,
    },
  ];
}

/** A file embed for a path relative to `root`, the outline's checkout: its size, hash, and first lines. */
function fileEmbed(spec: Extract<EmbedSpec, { kind: "file" }>, root: string): EmbedDraft {
  const bytes = readFileSync(join(root, spec.path));
  const preview = bytes.toString("utf8").replace(/^﻿/, "").split(/\r?\n/).slice(0, PREVIEW_LINES).join("\n");
  return {
    kind: "file",
    ...(spec.caption !== undefined ? { caption: spec.caption } : {}),
    path: spec.path,
    ...(spec.mediaType !== undefined ? { mediaType: spec.mediaType } : {}),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    preview,
  };
}

/** The media type a picture embed's path implies; only PNG and SVG are supported. */
function pictureMediaType(path: string): string {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".svg")) return "image/svg+xml";
  throw new Error(`picture ${path}: expected a .png or .svg file`);
}

/** A picture embed for a path relative to `root`, the outline's checkout, inlined as a data: URL. */
function pictureEmbed(spec: Extract<EmbedSpec, { kind: "picture" }>, root: string): EmbedDraft {
  const bytes = readFileSync(join(root, spec.path));
  if (bytes.length > MAX_PICTURE_BYTES) {
    throw new Error(`picture ${spec.path} is ${bytes.length} bytes, over the ${MAX_PICTURE_BYTES}-byte limit`);
  }
  const mediaType = pictureMediaType(spec.path);
  const src = `data:${mediaType};base64,${bytes.toString("base64")}`;
  return {
    kind: "picture",
    ...(spec.caption !== undefined ? { caption: spec.caption } : {}),
    src,
    alt: spec.alt,
  };
}

/**
 * The calls an agent answering from these analyses would have made, with
 * what the host returned: getAnalysis and evaluate per analysis, Read per
 * file, then getResult per node output that an embed shows a snapshot of.
 */
export async function toolCallsFor(
  embeds: readonly Embed[],
  analysisIds: readonly string[],
  api: NotebookApi,
): Promise<ToolCall[]> {
  const perAnalysis = await Promise.all(
    analysisIds.map(async (id): Promise<ToolCall[]> => {
      const [graph, state] = await Promise.all([api.getAnalysis(id).then(parseDocument), api.getAnalysisState(id)]);
      const ok = state.nodes.filter((n) => n.status === "Ok").length;
      const pending = state.nodes.filter((n) => n.status === "EffectPending");
      // EffectPending is not a failure (plan: "nothing writes until Run"): a
      // writer node stays pending until an explicit Run, by design.
      const settled = ok + pending.length === state.nodes.length;
      const { nodes, edges } = graph.structure;
      return [
        { name: "getAnalysis", ok: true, summary: `${id}: ${count(nodes.length, "node")}, ${count(edges.length, "edge")}` },
        {
          name: "evaluate",
          ok: settled,
          summary:
            pending.length > 0
              ? `${ok} of ${state.nodes.length} nodes Ok, ${count(pending.length, "node")} EffectPending (${pending.map((n) => n.nodeId).join(", ")})`
              : `${ok} of ${state.nodes.length} nodes Ok`,
        },
      ];
    }),
  );
  const files: ToolCall[] = embeds.flatMap((e) =>
    e.kind === "file" ? [{ name: "Read", ok: true, summary: `${e.path}: ${count(e.bytes ?? 0, "byte")}` }] : [],
  );
  const reads = new Map<string, ToolCall>();
  for (const e of embeds) {
    if (!("snapshot" in e)) continue;
    const { analysisId, nodeId, port } = e.source;
    const summary = `${analysisId} ${nodeId}.${port}: ${describeSnapshot(e.snapshot)}`;
    reads.set(`${analysisId}/${nodeId}/${port}`, { name: "getResult", ok: true, summary });
  }
  return [...perAnalysis.flat(), ...files, ...reads.values()];
}

const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** The analyses a turn's embeds read, in the order the embeds name them. */
function analysesOf(turn: OutlineTurn, specs: readonly EmbedSpec[]): string[] {
  return [...new Set(specs.map((s) => analysisIdOf(s, turn)).filter((id): id is string => id !== undefined))];
}

/** The embed specs for a turn: its own list, the automatic choice for an analysis turn, or none for a text-only turn. */
function specsFor(turn: OutlineTurn): readonly EmbedSpec[] {
  if (turn.embeds !== undefined) return turn.embeds;
  return turn.analysisId !== undefined ? [{ kind: "auto" }] : [];
}

async function writeNotebook(outline: Outline, outlineDir: string, api: NotebookApi, paths: Paths): Promise<Notebook> {
  await seedGraphs(outline, outlineDir, api, paths.placeholders);
  let notebook: Notebook = { ...emptyNotebook(outline.title, outline.createdUtc), host: outline.host };
  for (const turn of outline.turns) {
    const specs = specsFor(turn);
    const drafts = (await Promise.all(specs.map((s) => draftsFor(s, turn, api, paths.root)))).flat();
    const embeds = drafts.map((d, i) => ({ ...d, id: `e${i + 1}` }) as Embed);
    const tools = turn.tools ? [...turn.tools] : await toolCallsFor(embeds, analysesOf(turn, specs), api);
    const built = appendTurn(
      notebook,
      { text: turn.request },
      { text: turn.reply, tools, embeds, analysisId: turn.analysisId },
    );
    notebook = { ...built, turns: [...built.turns.slice(0, -1), withExtras(built.turns[built.turns.length - 1], turn)] };
  }
  return notebook;
}

// --- Seeding an outline's own graphs ---------------------------------------

/**
 * Saves each of the outline's graphs to the host under its file name (without
 * `.json`) as the analysis id, and waits for it to settle, before any turn is
 * built. Runs the graphs in order, one at a time, so two graphs that touch
 * the same host cache never race.
 */
async function seedGraphs(outline: Outline, outlineDir: string, api: NotebookApi, placeholders: Placeholders): Promise<void> {
  for (const relPath of outline.graphs ?? []) {
    const path = join(outlineDir, relPath);
    const text = expandPlaceholders(readFileSync(path, "utf8"), path, placeholders);
    const id = basename(relPath).replace(/\.json$/, "");
    const doc = parseDocument(text);
    const summary = await api.putAnalysis(id, text);
    await waitSettled(api, id, doc, summary.graphHash);
  }
}

/**
 * Polls GET /api/analyses/{id}/state until it reports every node of `doc` and
 * has caught up to `graphHash` (the host evaluates a PUT synchronously, so
 * this usually settles on the first read; a node still missing after the
 * timeout is named in the error). Once settled, throws naming each node left
 * in Error or Unavailable, since a seeded graph is meant to be green: a
 * writer node still EffectPending is fine and stays allowed (plan: "nothing
 * writes until Run").
 */
export async function waitSettled(api: NotebookApi, id: string, doc: GraphDocument, graphHash: string): Promise<void> {
  const nodeIds = doc.structure.nodes.map((n) => n.id);
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  for (;;) {
    const state = await api.getAnalysisState(id);
    const seen = new Set(state.nodes.map((n) => n.nodeId));
    const missing = nodeIds.filter((n) => !seen.has(n));
    if (state.graphHash === graphHash && missing.length === 0) {
      const failed = state.nodes.filter((n) => n.status === "Error" || n.status === "Unavailable");
      if (failed.length > 0) {
        const named = failed.map((n) => `${n.nodeId} (${n.status}${n.error ? `: ${n.error}` : ""})`).join(", ");
        throw new Error(`${id} settled with failing nodes: ${named}`);
      }
      return;
    }
    if (Date.now() > deadline) {
      const cause =
        missing.length > 0
          ? `node "${missing[0]}" never reported a status`
          : `state never caught up to graph hash ${graphHash}`;
      throw new Error(`${id} did not settle within ${SETTLE_TIMEOUT_MS / 1000}s: ${cause}`);
    }
    await sleep(SETTLE_POLL_MS);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// --- Command line ----------------------------------------------------------

function option(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function requiredOption(name: string): string {
  const value = option(name);
  if (!value) throw new Error(`missing ${name}; see the header of scripts/write-sample-notebooks.ts`);
  return value;
}

async function main(): Promise<void> {
  const outlinePath = resolve(requiredOption("--outline"));
  const paths: Paths = { root: outlineRoot(outlinePath), placeholders: parsePlaceholders(process.argv) };
  const name = basename(outlinePath).replace(/\.outline\.json$/, "");
  const raw = JSON.parse(readFileSync(outlinePath, "utf8")) as unknown;
  const errors = outlineErrors(raw, name);
  if (errors.length > 0) throw new Error(`${relative(paths.root, outlinePath)} is not a valid outline:\n${errors.join("\n")}`);
  const outline = raw as Outline;
  const api = new ApiClient({ baseUrl: requiredOption("--host") });
  const notebook = await writeNotebook(outline, dirname(outlinePath), api, paths);
  const text = hidePlaceholders(serializeNotebook(notebook), paths.placeholders, paths.root);
  const parsed = parseNotebook(text);
  if (!parsed.ok) throw new Error(`the written notebook does not parse:\n${parsed.errors.join("\n")}`);
  const outDir = option("--out") ? resolve(option("--out")!) : dirname(dirname(outlinePath));
  const out = join(outDir, `${name}${NOTEBOOK_EXTENSION}`);
  writeFileSync(out, text);
  console.log(`wrote ${relative(paths.root, out)}: ${notebook.turns.length} turns`);
}

// Runs only as the CLI entry point (vite-node scripts/write-sample-notebooks.ts),
// not when a test imports this module for its host-calling helpers (waitSettled):
// vitest sets VITEST=true for every test process (its own documented contract).
if (!process.env.VITEST) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
