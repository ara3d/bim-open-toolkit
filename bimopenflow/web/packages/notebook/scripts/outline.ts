/// <reference types="node" />
// The outline format (samples/notebooks/README.md), its validation, and the
// pure text transforms write-sample-notebooks.ts applies to a graph's text.
// Kept apart from the script's host-calling code so it can be unit-tested
// offline, without a running host.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { HostHint, ToolCall, Turn } from "../src/document/format";

/** The repository root: scripts/ sits five levels below it. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");

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

// --- Placeholders: {SNOWDON} and this checkout's own path -------------------

/**
 * The private Snowdon model: BIMOPENFLOW_SNOWDON when it names an existing
 * file, else the default location when that exists, else undefined.
 * Duplicates BimSampleSeeding.SnowdonPath in the host, which fills the same
 * placeholder only when it seeds an empty store, never on a PUT (plan, Debt).
 */
export function snowdonPath(): string | undefined {
  const fromEnv = process.env.BIMOPENFLOW_SNOWDON;
  const path =
    fromEnv && fromEnv.length > 0
      ? fromEnv
      : join(homedir(), "Documents", "BIM Open Schema", "Snowdon Towers Sample Architectural.bos");
  return existsSync(path) ? path : undefined;
}

/** Forward slashes need no escaping inside the graph's JSON strings. */
export const slashed = (path: string): string => path.split("\\").join("/");

/** Replaces {SNOWDON} in a graph's text, so no committed graph names a machine-local path. */
export function expandPlaceholders(text: string, graphPath: string): string {
  if (!text.includes("{SNOWDON}")) return text;
  const snowdon = snowdonPath();
  if (snowdon === undefined) {
    throw new Error(
      `${graphPath} needs the private Snowdon model, not found (set BIMOPENFLOW_SNOWDON or place it at the default location).`,
    );
  }
  return text.split("{SNOWDON}").join(slashed(snowdon));
}

/**
 * The reverse, for graph documents the host hands back inside graph embeds:
 * the Snowdon path becomes {SNOWDON} again (skipped when no Snowdon model is
 * configured), and paths inside this checkout (the host's expansion of
 * {SAMPLES} when it seeds) become repository-relative.
 */
export function hidePlaceholders(text: string): string {
  const snowdon = snowdonPath();
  const withoutSnowdon = snowdon ? text.split(slashed(snowdon)).join("{SNOWDON}") : text;
  const rootPrefix = `${slashed(ROOT)}/`;
  return rootPrefix.length > 1 ? withoutSnowdon.split(rootPrefix).join("") : withoutSnowdon;
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

/** Every problem with an outline, tagged with its JSON path; empty when it is valid. */
export function outlineErrors(value: unknown): string[] {
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
