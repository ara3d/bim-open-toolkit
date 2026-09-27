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
// command for each committed sample and documents the outline format,
// including the extensions for reconstructed sessions (graphs, tools, stale,
// earlier, picture and chart embeds) this script implements.
//
// An --out DIR option redirects the write to DIR/<name>.notebook.json instead
// of the outline's own folder, for comparing a regeneration without touching
// the committed file.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiClient } from "@bimopenflow/api-client";
import { parseDocument, type GraphDocument } from "@bimopenflow/state";
import { chartPaneOptions } from "@bimopenflow/app/src/paneChoice";
import { embedsForAnalysis } from "../src/ask/reply";
import type { Embed, HostHint, Notebook, NodeRef, ToolCall, Turn } from "../src/document/format";
import { emptyNotebook, parseNotebook, serializeNotebook } from "../src/document/io";
import { appendTurn } from "../src/document/edits";
import type { NotebookApi } from "../src/embeds/contract";
import { describeSnapshot, snapshotOf, SNAPSHOT_ROWS } from "../src/live/compare";

/** The repository root: scripts/ sits five levels below it. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");

/** Lines of a text file kept as a file embed's preview. */
const PREVIEW_LINES = 6;

/** A picture embed's file, inlined as a data: URL, may not exceed this. */
const MAX_PICTURE_BYTES = 400 * 1024;

/** How long a saved graph's nodes get to stop evaluating before waitSettled gives up. */
const SETTLE_TIMEOUT_MS = 30_000;
const SETTLE_POLL_MS = 200;

// --- The outline format (samples/notebooks/README.md) ---------------------

interface Outline {
  readonly title: string;
  readonly createdUtc: string;
  readonly host: HostHint;
  /** Paths, relative to this outline, of graph documents saved to the host before any snapshot. */
  readonly graphs?: readonly string[];
  readonly turns: readonly OutlineTurn[];
}

interface OutlineTurn {
  readonly request: string;
  readonly reply: string;
  /**
   * The seeded analysis that answers the turn; the reply's analysisId. Absent
   * means a text-only turn: no embeds and no generated tool calls (an
   * explicit `tools` list still applies).
   */
  readonly analysisId?: string;
  /** Replaces the automatic embeds; absent means [{ "kind": "auto" }] when analysisId is set, else none. */
  readonly embeds?: readonly EmbedSpec[];
  /** Replaces the generated tool-call list. */
  readonly tools?: readonly ToolCall[];
  /** An earlier turn was edited and resent after this reply was made. */
  readonly stale?: boolean;
  /** The versions this turn had before its request was edited and resent, oldest first. Text only. */
  readonly earlier?: readonly OutlineEarlier[];
}

interface OutlineEarlier {
  readonly request: string;
  readonly reply: string;
}

/** One entry of a turn's embed list; `analysisId` defaults to the turn's. */
type EmbedSpec =
  | { readonly kind: "auto"; readonly analysisId?: string }
  | { readonly kind: "graph"; readonly analysisId?: string; readonly focus?: readonly string[] }
  | NodeSpec<"value", { readonly column?: string; readonly unit?: string }>
  | NodeSpec<"table">
  | NodeSpec<"view3d">
  | NodeSpec<"chart">
  | {
      readonly kind: "file";
      readonly path: string;
      readonly mediaType?: string;
      readonly caption?: string;
    }
  | {
      readonly kind: "picture";
      readonly path: string;
      readonly alt: string;
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

async function draftsFor(spec: EmbedSpec, turn: OutlineTurn, api: NotebookApi): Promise<EmbedDraft[]> {
  if (spec.kind === "auto") return embedsForAnalysis(requireAnalysisId(spec, turn, "an auto embed"), api);
  if (spec.kind === "graph") {
    const analysisId = requireAnalysisId(spec, turn, "a graph embed");
    const auto = await embedsForAnalysis(analysisId, api);
    return auto.filter((e) => e.kind === "graph").map((e) => (spec.focus ? { ...e, focus: spec.focus } : e));
  }
  if (spec.kind === "file") return [fileEmbed(spec)];
  if (spec.kind === "picture") return [pictureEmbed(spec)];
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
    return [
      {
        kind: "chart",
        source,
        caption,
        chart: chartPaneOptions(node?.kind, graph.values[spec.node] ?? {}),
        snapshot,
      },
    ];
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

/** A file embed for a path relative to the repository: its size, hash, and first lines. */
function fileEmbed(spec: Extract<EmbedSpec, { kind: "file" }>): EmbedDraft {
  const bytes = readFileSync(join(ROOT, spec.path));
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

/** A picture embed for a path relative to the repository, inlined as a data: URL. */
function pictureEmbed(spec: Extract<EmbedSpec, { kind: "picture" }>): EmbedDraft {
  const bytes = readFileSync(join(ROOT, spec.path));
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
  return [...new Set(specs.map((s) => analysisIdOf(s, turn)).filter((id): id is string => id !== undefined))];
}

/** The embed specs for a turn: its own list, the automatic choice for an analysis turn, or none for a text-only turn. */
function specsFor(turn: OutlineTurn): readonly EmbedSpec[] {
  if (turn.embeds !== undefined) return turn.embeds;
  return turn.analysisId !== undefined ? [{ kind: "auto" }] : [];
}

async function writeNotebook(outline: Outline, outlineDir: string, api: NotebookApi): Promise<Notebook> {
  await seedGraphs(outline, outlineDir, api);
  let notebook: Notebook = { ...emptyNotebook(outline.title, outline.createdUtc), host: outline.host };
  for (const turn of outline.turns) {
    const specs = specsFor(turn);
    const drafts = (await Promise.all(specs.map((s) => draftsFor(s, turn, api)))).flat();
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

/** Adds an outline turn's stale mark and earlier-reply history (text only) to the turn appendTurn built. */
function withExtras(turn: Turn, outlineTurn: OutlineTurn): Turn {
  return {
    ...turn,
    ...(outlineTurn.stale !== undefined ? { stale: outlineTurn.stale } : {}),
    ...(outlineTurn.earlier !== undefined
      ? {
          earlier: outlineTurn.earlier.map((e) => ({
            request: { text: e.request },
            reply: { text: e.reply, tools: [], embeds: [] },
          })),
        }
      : {}),
  };
}

// --- Seeding an outline's own graphs ---------------------------------------

/**
 * Saves each of the outline's graphs to the host under its file name (without
 * `.json`) as the analysis id, and waits for it to settle, before any turn is
 * built. Runs the graphs in order, one at a time, so two graphs that touch
 * the same host cache never race.
 */
async function seedGraphs(outline: Outline, outlineDir: string, api: NotebookApi): Promise<void> {
  for (const relPath of outline.graphs ?? []) {
    const path = join(outlineDir, relPath);
    const text = expandPlaceholders(readFileSync(path, "utf8"), path);
    const id = basename(relPath).replace(/\.json$/, "");
    const doc = parseDocument(text);
    const summary = await api.putAnalysis(id, text);
    await waitSettled(api, id, doc, summary.graphHash);
  }
}

/**
 * The private Snowdon model: BIMOPENFLOW_SNOWDON, else the default location.
 * Duplicates BimSampleSeeding.SnowdonPath in the host, which fills the same
 * placeholder only when it seeds an empty store, never on a PUT (plan, Debt).
 */
function snowdonPath(): string {
  return (
    process.env.BIMOPENFLOW_SNOWDON ??
    join(homedir(), "Documents", "BIM Open Schema", "Snowdon Towers Sample Architectural.bos")
  );
}

/** Replaces {SNOWDON} in a graph's text, so no committed graph names a machine-local path. */
function expandPlaceholders(text: string, graphPath: string): string {
  if (!text.includes("{SNOWDON}")) return text;
  const snowdon = snowdonPath();
  if (!existsSync(snowdon)) {
    throw new Error(`${graphPath} needs the private Snowdon model, not found at ${snowdon} (set BIMOPENFLOW_SNOWDON).`);
  }
  return text.split("{SNOWDON}").join(slashed(snowdon));
}

/**
 * The reverse, for graph documents the host hands back inside graph embeds:
 * the Snowdon path becomes {SNOWDON} again, and paths inside this checkout
 * (the host's expansion of {SAMPLES} when it seeds) become repository-relative.
 */
function hidePlaceholders(text: string): string {
  return text
    .split(slashed(snowdonPath())).join("{SNOWDON}")
    .split(`${slashed(ROOT)}/`).join("");
}

/** Forward slashes need no escaping inside the graph's JSON strings. */
const slashed = (path: string): string => path.split("\\").join("/");

/**
 * Polls GET /api/analyses/{id}/state until it reports every node of `doc` and
 * has caught up to `graphHash` (the host evaluates a PUT synchronously, so
 * this usually settles on the first read; a node still missing after the
 * timeout is named in the error).
 */
async function waitSettled(api: NotebookApi, id: string, doc: GraphDocument, graphHash: string): Promise<void> {
  const nodeIds = doc.structure.nodes.map((n) => n.id);
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  for (;;) {
    const state = await api.getAnalysisState(id);
    const seen = new Set(state.nodes.map((n) => n.nodeId));
    const missing = nodeIds.filter((n) => !seen.has(n));
    if (state.graphHash === graphHash && missing.length === 0) return;
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

// --- Validating an outline before use ---------------------------------------
//
// Hand-written outlines fail the same way parseNotebook does: every problem
// is collected, tagged with its JSON path, instead of stopping at the first.
// This is a smaller, script-local schema (the outline format), so it does not
// share parseNotebook's private field/checkObject combinators in
// src/document/io.ts, which are not exported.

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function push(errors: string[], path: string, message: string): void {
  errors.push(`${path}: ${message}`);
}

/** Joins a path and a key, without a leading dot at the root ("" + "title" -> "title"). */
function childPath(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

function unknownKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, errors: string[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) push(errors, childPath(path, key), "unknown field");
  }
}

function requireString(value: Record<string, unknown>, key: string, path: string, errors: string[]): void {
  const fieldPath = childPath(path, key);
  if (value[key] === undefined) push(errors, fieldPath, "missing");
  else if (typeof value[key] !== "string") push(errors, fieldPath, "expected a string");
}

function optionalString(value: Record<string, unknown>, key: string, path: string, errors: string[]): void {
  if (value[key] !== undefined && typeof value[key] !== "string") push(errors, childPath(path, key), "expected a string");
}

function optionalBoolean(value: Record<string, unknown>, key: string, path: string, errors: string[]): void {
  if (value[key] !== undefined && typeof value[key] !== "boolean") push(errors, childPath(path, key), "expected a boolean");
}

function optionalStringArray(value: Record<string, unknown>, key: string, path: string, errors: string[]): void {
  const v = value[key];
  if (v === undefined) return;
  if (!Array.isArray(v)) {
    push(errors, childPath(path, key), "expected an array");
    return;
  }
  v.forEach((item, i) => {
    if (typeof item !== "string") push(errors, `${childPath(path, key)}[${i}]`, "expected a string");
  });
}

const EMBED_SPEC_FIELDS: Record<string, readonly string[]> = {
  auto: ["kind", "analysisId"],
  graph: ["kind", "analysisId", "focus"],
  value: ["kind", "analysisId", "node", "port", "caption", "column", "unit"],
  table: ["kind", "analysisId", "node", "port", "caption"],
  view3d: ["kind", "analysisId", "node", "port", "caption"],
  chart: ["kind", "analysisId", "node", "port", "caption"],
  file: ["kind", "path", "mediaType", "caption"],
  picture: ["kind", "path", "alt", "caption"],
};

function checkEmbedSpec(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    push(errors, path, "expected an object");
    return;
  }
  const kind = value.kind;
  if (typeof kind !== "string" || !(kind in EMBED_SPEC_FIELDS)) {
    push(errors, `${path}.kind`, `expected one of ${Object.keys(EMBED_SPEC_FIELDS).map((k) => `"${k}"`).join(", ")}`);
    return;
  }
  unknownKeys(value, EMBED_SPEC_FIELDS[kind], path, errors);
  optionalString(value, "analysisId", path, errors);
  optionalString(value, "caption", path, errors);
  if (kind === "graph") optionalStringArray(value, "focus", path, errors);
  if (kind === "value") {
    optionalString(value, "column", path, errors);
    optionalString(value, "unit", path, errors);
  }
  if (["value", "table", "view3d", "chart"].includes(kind)) {
    requireString(value, "node", path, errors);
    requireString(value, "port", path, errors);
  }
  if (kind === "file") {
    requireString(value, "path", path, errors);
    optionalString(value, "mediaType", path, errors);
  }
  if (kind === "picture") {
    requireString(value, "path", path, errors);
    requireString(value, "alt", path, errors);
  }
}

function checkToolCall(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    push(errors, path, "expected an object");
    return;
  }
  unknownKeys(value, ["name", "ok", "summary"], path, errors);
  requireString(value, "name", path, errors);
  requireString(value, "summary", path, errors);
  if (value.ok === undefined) push(errors, `${path}.ok`, "missing");
  else if (typeof value.ok !== "boolean") push(errors, `${path}.ok`, "expected a boolean");
}

function checkEarlier(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    push(errors, path, "expected an object");
    return;
  }
  unknownKeys(value, ["request", "reply"], path, errors);
  requireString(value, "request", path, errors);
  requireString(value, "reply", path, errors);
}

function checkTurn(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    push(errors, path, "expected an object");
    return;
  }
  unknownKeys(value, ["request", "reply", "analysisId", "embeds", "tools", "stale", "earlier"], path, errors);
  requireString(value, "request", path, errors);
  requireString(value, "reply", path, errors);
  optionalString(value, "analysisId", path, errors);
  optionalBoolean(value, "stale", path, errors);
  const embeds = value.embeds;
  if (embeds !== undefined) {
    if (!Array.isArray(embeds)) push(errors, `${path}.embeds`, "expected an array");
    else embeds.forEach((e, i) => checkEmbedSpec(e, `${path}.embeds[${i}]`, errors));
  }
  const tools = value.tools;
  if (tools !== undefined) {
    if (!Array.isArray(tools)) push(errors, `${path}.tools`, "expected an array");
    else tools.forEach((t, i) => checkToolCall(t, `${path}.tools[${i}]`, errors));
  }
  const earlier = value.earlier;
  if (earlier !== undefined) {
    if (!Array.isArray(earlier)) push(errors, `${path}.earlier`, "expected an array");
    else earlier.forEach((e, i) => checkEarlier(e, `${path}.earlier[${i}]`, errors));
  }
}

function checkHost(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    push(errors, path, "expected an object");
    return;
  }
  unknownKeys(value, ["profile", "note"], path, errors);
  optionalString(value, "profile", path, errors);
  optionalString(value, "note", path, errors);
}

/** Every problem with an outline, tagged with its JSON path; empty when it is valid. */
function outlineErrors(value: unknown): string[] {
  const errors: string[] = [];
  if (!isPlainObject(value)) return ["(root): expected an object"];
  unknownKeys(value, ["title", "createdUtc", "host", "graphs", "turns"], "", errors);
  requireString(value, "title", "", errors);
  requireString(value, "createdUtc", "", errors);
  if (value.host === undefined) push(errors, "host", "missing");
  else checkHost(value.host, "host", errors);
  optionalStringArray(value, "graphs", "", errors);
  const turns = value.turns;
  if (turns === undefined) push(errors, "turns", "missing");
  else if (!Array.isArray(turns)) push(errors, "turns", "expected an array");
  else turns.forEach((t, i) => checkTurn(t, `turns[${i}]`, errors));
  return errors;
}

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
  const raw = JSON.parse(readFileSync(outlinePath, "utf8")) as unknown;
  const errors = outlineErrors(raw);
  if (errors.length > 0) throw new Error(`${relative(ROOT, outlinePath)} is not a valid outline:\n${errors.join("\n")}`);
  const outline = raw as Outline;
  const api = new ApiClient({ baseUrl: requiredOption("--host") });
  const notebook = await writeNotebook(outline, dirname(outlinePath), api);
  const text = hidePlaceholders(serializeNotebook(notebook));
  const parsed = parseNotebook(text);
  if (!parsed.ok) throw new Error(`the written notebook does not parse:\n${parsed.errors.join("\n")}`);
  const name = basename(outlinePath).replace(/\.outline\.json$/, "");
  const outDir = option("--out") ? resolve(option("--out")!) : dirname(dirname(outlinePath));
  const out = join(outDir, `${name}${NOTEBOOK_SUFFIX}`);
  writeFileSync(out, text);
  console.log(`wrote ${relative(ROOT, out)}: ${notebook.turns.length} turns`);
}

const NOTEBOOK_SUFFIX = ".notebook.json";

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
