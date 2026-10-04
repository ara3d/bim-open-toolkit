/// <reference types="node" />
// The outline format (samples/notebooks/README.md), its validation, and the
// pure text transforms write-sample-notebooks.ts applies to a graph's text.
// Kept apart from the script's host-calling code so it can be unit-tested
// offline, without a running host.

import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { HostHint, ToolCall, Turn } from "../src/document/format";

export interface Outline {
  readonly title: string;
  readonly createdUtc: string;
  readonly host: HostHint;
  /** Paths, relative to this outline, of graph documents saved to the host before any snapshot. */
  readonly graphs?: readonly string[];
  readonly turns: readonly OutlineTurn[];
}

export interface OutlineTurn {
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

export interface OutlineEarlier {
  readonly request: string;
  readonly reply: string;
}

/** One entry of a turn's embed list; `analysisId` defaults to the turn's. */
export type EmbedSpec =
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

export type NodeSpec<K extends string, Extra = object> = {
  readonly kind: K;
  readonly analysisId?: string;
  readonly node: string;
  readonly port: string;
  readonly caption?: string;
} & Extra;

/** Adds an outline turn's stale mark and earlier-reply history (text only) to the turn appendTurn built. */
export function withExtras(turn: Turn, outlineTurn: OutlineTurn): Turn {
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

// --- Placeholders: {NAME} in a graph's text, and the outline's own checkout ---

/** Placeholder names (without braces) and the paths they stand for, given by the caller. */
export type Placeholders = ReadonlyMap<string, string>;

const PLACEHOLDER_NAME = /^[A-Z][A-Z0-9_]*$/;
const PLACEHOLDER_TOKEN = /\{([A-Z][A-Z0-9_]*)\}/g;

/**
 * The placeholders a command line gives as `--placeholder NAME=path`, the
 * path resolved against the working directory. A malformed value or a name
 * given twice is an error.
 */
export function parsePlaceholders(argv: readonly string[]): Placeholders {
  const placeholders = new Map<string, string>();
  argv.forEach((arg, i) => {
    if (arg !== "--placeholder") return;
    const value = argv[i + 1] ?? "";
    const eq = value.indexOf("=");
    const name = value.slice(0, eq);
    if (eq < 0 || !PLACEHOLDER_NAME.test(name) || eq === value.length - 1)
      throw new Error(`--placeholder expects NAME=path with NAME in capitals, got "${value}"`);
    if (placeholders.has(name)) throw new Error(`--placeholder ${name} is given twice`);
    placeholders.set(name, resolve(value.slice(eq + 1)));
  });
  return placeholders;
}

/** Forward slashes need no escaping inside the graph's JSON strings. */
export const slashed = (path: string): string => path.split("\\").join("/");

/**
 * Replaces every {NAME} in a graph's text with its path from `placeholders`,
 * so no committed graph names a machine-local path. A {NAME} with no entry
 * is an error naming `graphPath` and the option that supplies it.
 */
export function expandPlaceholders(text: string, graphPath: string, placeholders: Placeholders): string {
  return text.replace(PLACEHOLDER_TOKEN, (_token, name: string) => {
    const path = placeholders.get(name);
    if (path === undefined) throw new Error(`${graphPath} needs {${name}}; pass --placeholder ${name}=<path>`);
    return slashed(path);
  });
}

/**
 * The reverse, for graph documents the host hands back inside graph embeds:
 * each placeholder's path becomes {NAME} again (longest path first, so a
 * path inside another is not split), and paths inside `root` (the host's
 * expansion of {SAMPLES} when it seeds) become root-relative.
 */
export function hidePlaceholders(text: string, placeholders: Placeholders, root: string): string {
  const byLength = [...placeholders].filter(([, path]) => path.length > 0).sort(([, a], [, b]) => b.length - a.length);
  const hidden = byLength.reduce((t, [name, path]) => t.split(slashed(path)).join(`{${name}}`), text);
  const rootPrefix = `${slashed(root)}/`;
  return rootPrefix.length > 1 ? hidden.split(rootPrefix).join("") : hidden;
}

/**
 * The checkout an outline belongs to: the nearest folder above it that holds
 * `.git`. File and picture embeds name paths relative to it, and
 * hidePlaceholders strips it.
 */
export function outlineRoot(outlinePath: string): string {
  for (let dir = dirname(resolve(outlinePath)); ; dir = dirname(dir)) {
    if (existsSync(join(dir, ".git"))) return dir;
    if (dirname(dir) === dir) throw new Error(`${outlinePath} is not inside a git checkout`);
  }
}

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

/** The analysis ids named by an outline's own `graphs` list (its file names, without `.json`). */
function graphIdsOf(outline: Record<string, unknown>): string[] {
  const graphs = outline.graphs;
  if (!Array.isArray(graphs)) return [];
  return graphs
    .filter((g): g is string => typeof g === "string")
    .map((path) => basename(path).replace(/\.json$/, ""));
}

/**
 * Every problem with an outline, tagged with its JSON path; empty when it is
 * valid. `outlineName` is the outline's own file name (without
 * `.outline.json`); when given, an outline's own graph ids must start with
 * `nb-<outlineName>-` (samples/notebooks/README.md), so two outlines' seeded
 * graphs never collide on the host.
 */
export function outlineErrors(value: unknown, outlineName?: string): string[] {
  const errors: string[] = [];
  if (!isPlainObject(value)) return ["(root): expected an object"];
  unknownKeys(value, ["title", "createdUtc", "host", "graphs", "turns"], "", errors);
  requireString(value, "title", "", errors);
  requireString(value, "createdUtc", "", errors);
  if (value.host === undefined) push(errors, "host", "missing");
  else checkHost(value.host, "host", errors);
  optionalStringArray(value, "graphs", "", errors);
  if (outlineName !== undefined) {
    const prefix = `nb-${outlineName}-`;
    for (const [i, id] of graphIdsOf(value).entries()) {
      if (!id.startsWith(prefix)) push(errors, `graphs[${i}]`, `graph id "${id}" must start with "${prefix}"`);
    }
  }
  const turns = value.turns;
  if (turns === undefined) push(errors, "turns", "missing");
  else if (!Array.isArray(turns)) push(errors, "turns", "expected an array");
  else turns.forEach((t, i) => checkTurn(t, `turns[${i}]`, errors));
  return errors;
}
