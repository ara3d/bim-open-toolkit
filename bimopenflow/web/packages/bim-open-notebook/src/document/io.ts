// Reading and writing notebook files: validation with messages a person can
// act on, and a stable serialization so a saved notebook diffs cleanly.
//
// These files are hand-written for samples and saved by the page, so a
// mistake must fail loudly and say where: parseNotebook collects every
// problem it finds, each tagged with the JSON path that has it (e.g.
// "turns[2].reply.embeds[0].snapshot.rows: expected an array"), instead of
// stopping at the first one. An unrecognised field is reported too, because a
// misspelt key would otherwise be silently dropped.

import {
  EMBED_KINDS,
  NOTEBOOK_FORMAT,
  type AgentInfo,
  type ChartEmbed,
  type Embed,
  type EmbedKind,
  type FileEmbed,
  type GraphEmbed,
  type HostHint,
  type Notebook,
  type NodeRef,
  type PictureEmbed,
  type Reply,
  type Request,
  type TableSnapshot,
  type ToolCall,
  type Turn,
  type ValueEmbed,
  type View3dEmbed,
} from "./format";

export type ParseResult =
  | { readonly ok: true; readonly notebook: Notebook }
  | { readonly ok: false; readonly errors: readonly string[] };

// --- A small validation combinator library, private to this file --------
//
// A `Check` validates one JSON value found at `path` and appends a message
// per problem to `errors`; it never throws. `checkObject` builds a `Check`
// from a list of fields, and also rejects any field not in the list, since an
// unknown key in a hand-written file is a mistake, not an extension.

type Check = (value: unknown, path: string, errors: string[]) => void;

interface FieldSpec {
  readonly key: string;
  readonly required: boolean;
  readonly check: Check;
}

const field = (key: string, check: Check, required = true): FieldSpec => ({
  key,
  required,
  check,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const pushError = (errors: string[], path: string, message: string): void => {
  errors.push(`${path}: ${message}`);
};

const childPath = (path: string, key: string): string =>
  path === "" ? key : `${path}.${key}`;

const checkString: Check = (value, path, errors) => {
  if (typeof value !== "string") pushError(errors, path, "expected a string");
};

const checkBoolean: Check = (value, path, errors) => {
  if (typeof value !== "boolean") pushError(errors, path, "expected a boolean");
};

const checkNumber: Check = (value, path, errors) => {
  if (typeof value !== "number") pushError(errors, path, "expected a number");
};

const checkStringArray: Check = (value, path, errors) => {
  if (!Array.isArray(value)) {
    pushError(errors, path, "expected an array");
    return;
  }
  value.forEach((item, i) => {
    if (typeof item !== "string") pushError(errors, `${path}[${i}]`, "expected a string");
  });
};

const checkArrayOf = (itemCheck: Check): Check => (value, path, errors) => {
  if (!Array.isArray(value)) {
    pushError(errors, path, "expected an array");
    return;
  }
  value.forEach((item, i) => itemCheck(item, `${path}[${i}]`, errors));
};

const checkLiteral = (literal: string): Check => (value, path, errors) => {
  if (value !== literal) pushError(errors, path, `expected "${literal}"`);
};

const checkEnum = (values: readonly string[]): Check => (value, path, errors) => {
  if (typeof value !== "string" || !values.includes(value)) {
    pushError(errors, path, `expected one of ${values.map((v) => `"${v}"`).join(", ")}`);
  }
};

/** Validates a JSON object against a fixed set of fields; any other key is an error. */
const checkObject = (fields: readonly FieldSpec[]): Check => (value, path, errors) => {
  if (!isPlainObject(value)) {
    pushError(errors, path, "expected an object");
    return;
  }
  const allowed = new Set(fields.map((f) => f.key));
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) pushError(errors, childPath(path, key), "unknown field");
  }
  for (const f of fields) {
    const fieldValue = value[f.key];
    const fieldPath = childPath(path, f.key);
    if (fieldValue === undefined) {
      if (f.required) pushError(errors, fieldPath, "missing");
      continue;
    }
    f.check(fieldValue, fieldPath, errors);
  }
};

// --- Schemas for the shared shapes in format.ts --------------------------

const checkNodeRef = checkObject([
  field("analysisId", checkString),
  field("nodeId", checkString),
  field("port", checkString),
]);

const checkColumnSchema = checkObject([
  field("name", checkString),
  field("type", checkEnum(["Boolean", "Integer", "Number", "Text"])),
]);

const checkRow: Check = (value, path, errors) => {
  if (!Array.isArray(value)) pushError(errors, path, "expected an array");
};

const checkTableSnapshot = checkObject([
  field("columns", checkArrayOf(checkColumnSchema)),
  field("rows", checkArrayOf(checkRow)),
  field("totalRows", checkNumber),
  field("skip", checkNumber),
]);

const checkHostHint = checkObject([
  field("profile", checkString, false),
  field("note", checkString, false),
]);

const checkToolCall = checkObject([
  field("name", checkString),
  field("ok", checkBoolean),
  field("summary", checkString),
]);

const checkAgentInfo = checkObject([
  field("model", checkString, false),
  field("effort", checkString, false),
  field("turns", checkNumber, false),
  field("inputTokens", checkNumber, false),
  field("outputTokens", checkNumber, false),
]);

const checkRequest = checkObject([
  field("text", checkString),
  field("atUtc", checkString, false),
  field("files", checkStringArray, false),
]);

/**
 * A chart embed's `chart` field is the host pane's own `ChartPaneOptions`
 * (bar or line, with that chart kind's viz options): a contract this package
 * does not own. This checks only the part format.ts documents (a "bar" or
 * "line" tag) and otherwise treats it as an opaque object, so a legitimate
 * viz option is never flagged as an unknown field.
 */
const checkChartOptions: Check = (value, path, errors) => {
  if (!isPlainObject(value)) {
    pushError(errors, path, "expected an object");
    return;
  }
  const chart = value["chart"];
  if (chart !== "bar" && chart !== "line") {
    pushError(errors, childPath(path, "chart"), 'expected "bar" or "line"');
  }
};

// --- Embed schemas, one per kind in format.ts's EMBED_KINDS order --------

const baseEmbedFields: readonly FieldSpec[] = [
  field("id", checkString),
  field("caption", checkString, false),
];

const checkValueEmbed = checkObject([
  ...baseEmbedFields,
  field("kind", checkLiteral("value")),
  field("source", checkNodeRef),
  field("column", checkString, false),
  field("unit", checkString, false),
  field("snapshot", checkTableSnapshot),
]);

const checkTableEmbed = checkObject([
  ...baseEmbedFields,
  field("kind", checkLiteral("table")),
  field("source", checkNodeRef),
  field("snapshot", checkTableSnapshot),
]);

const checkChartEmbed = checkObject([
  ...baseEmbedFields,
  field("kind", checkLiteral("chart")),
  field("source", checkNodeRef),
  field("chart", checkChartOptions),
  field("snapshot", checkTableSnapshot),
]);

const checkGraphEmbed = checkObject([
  ...baseEmbedFields,
  field("kind", checkLiteral("graph")),
  field("analysisId", checkString),
  field("graphHash", checkString, false),
  field("document", checkString, false),
  field("text", checkString, false),
  field("focus", checkStringArray, false),
]);

const checkView3dEmbed = checkObject([
  ...baseEmbedFields,
  field("kind", checkLiteral("view3d")),
  field("source", checkNodeRef),
  field("still", checkString, false),
]);

const checkPictureEmbed = checkObject([
  ...baseEmbedFields,
  field("kind", checkLiteral("picture")),
  field("src", checkString),
  field("alt", checkString),
]);

const checkFileEmbed = checkObject([
  ...baseEmbedFields,
  field("kind", checkLiteral("file")),
  field("path", checkString),
  field("mediaType", checkString, false),
  field("bytes", checkNumber, false),
  field("sha256", checkString, false),
  field("preview", checkString, false),
]);

const embedChecks: { readonly [K in EmbedKind]: Check } = {
  value: checkValueEmbed,
  table: checkTableEmbed,
  chart: checkChartEmbed,
  graph: checkGraphEmbed,
  view3d: checkView3dEmbed,
  picture: checkPictureEmbed,
  file: checkFileEmbed,
};

const checkEmbed: Check = (value, path, errors) => {
  if (!isPlainObject(value)) {
    pushError(errors, path, "expected an object");
    return;
  }
  const kind = value["kind"];
  if (typeof kind !== "string") {
    pushError(errors, childPath(path, "kind"), "expected a string");
    return;
  }
  if (!(EMBED_KINDS as readonly string[]).includes(kind)) {
    pushError(errors, childPath(path, "kind"), `unknown embed kind "${kind}"`);
    return;
  }
  embedChecks[kind as EmbedKind](value, path, errors);
};

/** Embed ids must be unique within one reply; reports the second and later occurrences. */
const checkEmbedIdsUnique = (embeds: unknown, path: string, errors: string[]): void => {
  if (!Array.isArray(embeds)) return;
  const seen = new Set<string>();
  embeds.forEach((embed, i) => {
    if (!isPlainObject(embed) || typeof embed["id"] !== "string") return;
    const id = embed["id"];
    const idPath = `${path}[${i}].id`;
    if (seen.has(id)) pushError(errors, idPath, `duplicate embed id "${id}" in this reply`);
    else seen.add(id);
  });
};

const checkReplyShape = checkObject([
  field("text", checkString),
  field("tools", checkArrayOf(checkToolCall)),
  field("embeds", checkArrayOf(checkEmbed)),
  field("analysisId", checkString, false),
  field("agent", checkAgentInfo, false),
  field("error", checkString, false),
]);

const checkReply: Check = (value, path, errors) => {
  checkReplyShape(value, path, errors);
  if (isPlainObject(value)) {
    checkEmbedIdsUnique(value["embeds"], childPath(path, "embeds"), errors);
  }
};

const checkEarlierReply = checkObject([
  field("request", checkRequest),
  field("reply", checkReply),
]);

const checkTurnShape = checkObject([
  field("id", checkString),
  field("request", checkRequest),
  field("reply", checkReply),
  field("stale", checkBoolean, false),
  field("earlier", checkArrayOf(checkEarlierReply), false),
]);

/** Turn ids must be unique within the notebook; reports the second and later occurrences. */
const checkTurnIdsUnique = (turns: unknown, errors: string[]): void => {
  if (!Array.isArray(turns)) return;
  const seen = new Set<string>();
  turns.forEach((turn, i) => {
    if (!isPlainObject(turn) || typeof turn["id"] !== "string") return;
    const id = turn["id"];
    const idPath = `turns[${i}].id`;
    if (seen.has(id)) pushError(errors, idPath, `duplicate turn id "${id}"`);
    else seen.add(id);
  });
};

const checkNotebookShape = checkObject([
  field("format", checkLiteral(NOTEBOOK_FORMAT)),
  field("title", checkString),
  field("createdUtc", checkString),
  field("host", checkHostHint, false),
  field("turns", checkArrayOf(checkTurnShape)),
]);

/** Parses and validates a notebook file; every problem found is listed, with its JSON path. */
export function parseNotebook(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, errors: [message] };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, errors: ["(root): expected an object"] };
  }

  const errors: string[] = [];
  checkNotebookShape(parsed, "", errors);
  checkTurnIdsUnique(parsed["turns"], errors);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, notebook: parsed as unknown as Notebook };
}

// --- Serialization: two-space JSON, format.ts's field order, final newline

const serializeNodeRef = (ref: NodeRef): Record<string, unknown> => ({
  analysisId: ref.analysisId,
  nodeId: ref.nodeId,
  port: ref.port,
});

const serializeSnapshot = (snapshot: TableSnapshot): Record<string, unknown> => ({
  columns: snapshot.columns,
  rows: snapshot.rows,
  totalRows: snapshot.totalRows,
  skip: snapshot.skip,
});

const serializeToolCall = (tool: ToolCall): Record<string, unknown> => ({
  name: tool.name,
  ok: tool.ok,
  summary: tool.summary,
});

const serializeAgentInfo = (agent: AgentInfo): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (agent.model !== undefined) out.model = agent.model;
  if (agent.effort !== undefined) out.effort = agent.effort;
  if (agent.turns !== undefined) out.turns = agent.turns;
  if (agent.inputTokens !== undefined) out.inputTokens = agent.inputTokens;
  if (agent.outputTokens !== undefined) out.outputTokens = agent.outputTokens;
  return out;
};

const serializeRequest = (request: Request): Record<string, unknown> => {
  const out: Record<string, unknown> = { text: request.text };
  if (request.atUtc !== undefined) out.atUtc = request.atUtc;
  if (request.files !== undefined) out.files = request.files;
  return out;
};

/**
 * Every embed's own fields are serialized in the order format.ts declares
 * them for that kind, except "kind" and "id" lead (declared on EmbedBase,
 * which format.ts lists before the per-kind fields, but a tag and its id read
 * best first) and "caption" follows them.
 */
const serializeEmbed = (embed: Embed): Record<string, unknown> => {
  const out: Record<string, unknown> = { kind: embed.kind, id: embed.id };
  if (embed.caption !== undefined) out.caption = embed.caption;
  switch (embed.kind) {
    case "value": {
      const e: ValueEmbed = embed;
      out.source = serializeNodeRef(e.source);
      if (e.column !== undefined) out.column = e.column;
      if (e.unit !== undefined) out.unit = e.unit;
      out.snapshot = serializeSnapshot(e.snapshot);
      return out;
    }
    case "table": {
      out.source = serializeNodeRef(embed.source);
      out.snapshot = serializeSnapshot(embed.snapshot);
      return out;
    }
    case "chart": {
      const e: ChartEmbed = embed;
      out.source = serializeNodeRef(e.source);
      out.chart = e.chart;
      out.snapshot = serializeSnapshot(e.snapshot);
      return out;
    }
    case "graph": {
      const e: GraphEmbed = embed;
      out.analysisId = e.analysisId;
      if (e.graphHash !== undefined) out.graphHash = e.graphHash;
      if (e.document !== undefined) out.document = e.document;
      if (e.text !== undefined) out.text = e.text;
      if (e.focus !== undefined) out.focus = e.focus;
      return out;
    }
    case "view3d": {
      const e: View3dEmbed = embed;
      out.source = serializeNodeRef(e.source);
      if (e.still !== undefined) out.still = e.still;
      return out;
    }
    case "picture": {
      const e: PictureEmbed = embed;
      out.src = e.src;
      out.alt = e.alt;
      return out;
    }
    case "file": {
      const e: FileEmbed = embed;
      out.path = e.path;
      if (e.mediaType !== undefined) out.mediaType = e.mediaType;
      if (e.bytes !== undefined) out.bytes = e.bytes;
      if (e.sha256 !== undefined) out.sha256 = e.sha256;
      if (e.preview !== undefined) out.preview = e.preview;
      return out;
    }
  }
};

const serializeReply = (reply: Reply): Record<string, unknown> => {
  const out: Record<string, unknown> = {
    text: reply.text,
    tools: reply.tools.map(serializeToolCall),
    embeds: reply.embeds.map(serializeEmbed),
  };
  if (reply.analysisId !== undefined) out.analysisId = reply.analysisId;
  if (reply.agent !== undefined) out.agent = serializeAgentInfo(reply.agent);
  if (reply.error !== undefined) out.error = reply.error;
  return out;
};

const serializeTurn = (turn: Turn): Record<string, unknown> => {
  const out: Record<string, unknown> = {
    id: turn.id,
    request: serializeRequest(turn.request),
    reply: serializeReply(turn.reply),
  };
  if (turn.stale !== undefined) out.stale = turn.stale;
  if (turn.earlier !== undefined) {
    out.earlier = turn.earlier.map((earlier) => ({
      request: serializeRequest(earlier.request),
      reply: serializeReply(earlier.reply),
    }));
  }
  return out;
};

const serializeHostHint = (host: HostHint): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (host.profile !== undefined) out.profile = host.profile;
  if (host.note !== undefined) out.note = host.note;
  return out;
};

/** Two-space JSON with keys in a fixed order and a final newline; parseNotebook(serializeNotebook(n)) equals n. */
export function serializeNotebook(notebook: Notebook): string {
  const out: Record<string, unknown> = {
    format: notebook.format,
    title: notebook.title,
    createdUtc: notebook.createdUtc,
  };
  if (notebook.host !== undefined) out.host = serializeHostHint(notebook.host);
  out.turns = notebook.turns.map(serializeTurn);
  return `${JSON.stringify(out, null, 2)}\n`;
}

/** A notebook with no turns. */
export function emptyNotebook(title: string, createdUtc: string): Notebook {
  return { format: NOTEBOOK_FORMAT, title, createdUtc, turns: [] };
}
