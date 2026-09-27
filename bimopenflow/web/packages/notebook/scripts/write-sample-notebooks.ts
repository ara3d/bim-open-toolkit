/// <reference types="node" />
// Writes one sample notebook from an outline and a running host, so every
// number in a sample comes from a graph. The outline format is documented in
// samples/notebooks/README.md; the reply texts are the outline's, the embeds,
// snapshots, and tool calls are read from the host.
//
// Rerun from bimopenflow/web/packages/notebook, against a host of the
// outline's profile (node scripts/start-bim-flow.mjs starts one):
//
//   npx vite-node scripts/write-sample-notebooks.ts -- --host http://127.0.0.1:5224 \
//     --outline ../../../../samples/notebooks/outlines/nrc-eight-questions.outline.json
//
// The notebook is written as <name>.notebook.json in the folder above the
// outline's (outlines/nrc-x.outline.json gives nrc-x.notebook.json), and is
// checked with parseNotebook first. samples/notebooks/README.md gives the
// command for each committed sample and documents the outline format.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiClient } from "@bimopenflow/api-client";
import { parseDocument } from "@bimopenflow/state";
import { embedsForAnalysis } from "../src/ask/reply";
import { appendTurn } from "../src/document/edits";
import type { Embed, HostHint, Notebook, NodeRef, ToolCall } from "../src/document/format";
import { emptyNotebook, parseNotebook, serializeNotebook } from "../src/document/io";
import type { NotebookApi } from "../src/embeds/contract";
import { describeSnapshot, snapshotOf, SNAPSHOT_ROWS } from "../src/live/compare";

/** The repository root: scripts/ sits five levels below it. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");

/** Lines of a text file kept as a file embed's preview. */
const PREVIEW_LINES = 6;

// --- The outline format (samples/notebooks/README.md) ---------------------

interface Outline {
  readonly title: string;
  readonly createdUtc: string;
  readonly host: HostHint;
  readonly turns: readonly OutlineTurn[];
}

interface OutlineTurn {
  readonly request: string;
  readonly reply: string;
  /** The seeded analysis that answers the turn; the reply's analysisId. */
  readonly analysisId: string;
  /** Replaces the automatic embeds; absent means [{ "kind": "auto" }]. */
  readonly embeds?: readonly EmbedSpec[];
}

/** One entry of a turn's embed list; `analysisId` defaults to the turn's. */
type EmbedSpec =
  | { readonly kind: "auto"; readonly analysisId?: string }
  | { readonly kind: "graph"; readonly analysisId?: string; readonly focus?: readonly string[] }
  | NodeSpec<"value", { readonly column?: string; readonly unit?: string }>
  | NodeSpec<"table">
  | NodeSpec<"view3d">
  | {
      readonly kind: "file";
      readonly path: string;
      readonly mediaType?: string;
      readonly caption?: string;
    };

type NodeSpec<K extends string, Extra = object> = {
  readonly kind: K;
  readonly analysisId?: string;
  readonly node: string;
  readonly port: string;
  readonly caption?: string;
} & Extra;

// --- Building the notebook -------------------------------------------------

/** An embed before it is numbered within its reply. */
type Draft<E> = E extends Embed ? Omit<E, "id"> : never;
type EmbedDraft = Draft<Embed>;

async function draftsFor(spec: EmbedSpec, turn: OutlineTurn, api: NotebookApi): Promise<EmbedDraft[]> {
  if (spec.kind === "auto") return embedsForAnalysis(spec.analysisId ?? turn.analysisId, api);
  if (spec.kind === "graph") {
    const auto = await embedsForAnalysis(spec.analysisId ?? turn.analysisId, api);
    return auto.filter((e) => e.kind === "graph").map((e) => (spec.focus ? { ...e, focus: spec.focus } : e));
  }
  if (spec.kind === "file") return [fileEmbed(spec)];
  const source: NodeRef = { analysisId: spec.analysisId ?? turn.analysisId, nodeId: spec.node, port: spec.port };
  const caption = spec.caption ?? `${spec.node}.${spec.port}`;
  if (spec.kind === "view3d") return [{ kind: "view3d", source, caption }];
  const slice = await api.getResult(source.analysisId, source.nodeId, source.port, 0, SNAPSHOT_ROWS);
  const snapshot = snapshotOf(slice);
  if (spec.kind === "table") return [{ kind: "table", source, caption, snapshot }];
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

/** A file embed for a path relative to the repository: its size, hash, and first lines. */
function fileEmbed(spec: Extract<EmbedSpec, { kind: "file" }>): EmbedDraft {
  const bytes = readFileSync(join(ROOT, spec.path));
  const preview = bytes.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/).slice(0, PREVIEW_LINES).join("\n");
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

/**
 * The calls an agent answering from these analyses would have made, with
 * what the host returned: getAnalysis and evaluate per analysis, Read per
 * file, then getResult per node output that an embed shows a snapshot of.
 */
async function toolCallsFor(embeds: readonly Embed[], analysisIds: readonly string[], api: NotebookApi): Promise<ToolCall[]> {
  const perAnalysis = await Promise.all(
    analysisIds.map(async (id): Promise<ToolCall[]> => {
      const [graph, state] = await Promise.all([api.getAnalysis(id).then(parseDocument), api.getAnalysisState(id)]);
      const ok = state.nodes.filter((n) => n.status === "Ok").length;
      const { nodes, edges } = graph.structure;
      return [
        { name: "getAnalysis", ok: true, summary: `${id}: ${count(nodes.length, "node")}, ${count(edges.length, "edge")}` },
        { name: "evaluate", ok: ok === state.nodes.length, summary: `${ok} of ${state.nodes.length} nodes Ok` },
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
  return [...new Set(specs.flatMap((s) => (s.kind === "file" ? [] : [s.analysisId ?? turn.analysisId])))];
}

async function writeNotebook(outline: Outline, api: NotebookApi): Promise<Notebook> {
  let notebook: Notebook = { ...emptyNotebook(outline.title, outline.createdUtc), host: outline.host };
  for (const turn of outline.turns) {
    const specs = turn.embeds ?? [{ kind: "auto" }];
    const drafts = (await Promise.all(specs.map((s) => draftsFor(s, turn, api)))).flat();
    const embeds = drafts.map((d, i) => ({ ...d, id: `e${i + 1}` }) as Embed);
    const tools = await toolCallsFor(embeds, analysesOf(turn, specs), api);
    notebook = appendTurn(
      notebook,
      { text: turn.request },
      { text: turn.reply, tools, embeds, analysisId: turn.analysisId },
    );
  }
  return notebook;
}

// --- Command line ----------------------------------------------------------

function option(name: string): string {
  const i = process.argv.indexOf(name);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (!value) throw new Error(`missing ${name}; see the header of scripts/write-sample-notebooks.ts`);
  return value;
}

async function main(): Promise<void> {
  const outlinePath = resolve(option("--outline"));
  const outline = JSON.parse(readFileSync(outlinePath, "utf8")) as Outline;
  const api = new ApiClient({ baseUrl: option("--host") });
  const notebook = await writeNotebook(outline, api);
  const text = serializeNotebook(notebook);
  const parsed = parseNotebook(text);
  if (!parsed.ok) throw new Error(`the written notebook does not parse:\n${parsed.errors.join("\n")}`);
  const name = basename(outlinePath).replace(/\.outline\.json$/, "");
  const out = join(dirname(dirname(outlinePath)), `${name}.notebook.json`);
  writeFileSync(out, text);
  console.log(`wrote ${relative(ROOT, out)}: ${notebook.turns.length} turns`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
