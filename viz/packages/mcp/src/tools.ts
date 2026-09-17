// Command descriptors as MCP tool definitions. Pure: no transport, no session, no SDK.
//
// A command already describes itself - name, title, description and a JSON-schema-like input
// description that the command itself validates against - so a tool definition is a rename and a
// conversion, not a second contract. Two things have to happen on the way.
//
// **A tool name is not a command name.** MCP tool names are letters, digits, underscore and hyphen,
// while command names are dotted (`sets.define`). The dot becomes an underscore and the tool carries
// the command name it stands for, so nothing has to guess the way back.
//
// **A schema becomes plain JSON.** `JsonSchema` is a TypeScript shape with optional properties;
// what travels to a client is JSON with those properties absent. `jsonOf` does that conversion, and
// `jsonValueSchema` checks it coming back, which is the only validation the bridge does of its own
// accord. Everything else is checked by the command that will run.

import {
  diagnostic,
  failure,
  mapped,
  object,
  record,
  refine,
  resultOf,
  string,
  success,
  warning,
  type CommandDescriptor,
  type Diagnostic,
  type DiagnosticPath,
  type JsonSchema,
  type Result,
  type Schema,
} from '@bim-open-toolkit/model';

// JSON as it travels: what a tool's input schema is made of and what a tool call carries.
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

// A JSON object, which is what a schema description and a tool call's arguments always are.
export type JsonRecord = { readonly [key: string]: JsonValue };

// A tool's input schema: the object schema MCP requires, with whatever else the description holds.
export type ToolInputSchema = JsonRecord & { readonly type: 'object' };

// True when the value is an array, narrowing to unknown elements rather than to `any`.
const isArray: (value: unknown) => value is readonly unknown[] = Array.isArray;

// True when the value is a non-array object, so its properties can be read.
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !isArray(value);

const checkJson = (value: unknown, path: DiagnosticPath): Result<JsonValue> => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return success(value);
  if (typeof value === 'number')
    return Number.isFinite(value)
      ? success(value)
      : failure([diagnostic('mcp/not-json', `The number ${String(value)} cannot travel as JSON.`, path)]);
  if (isArray(value)) {
    const results = value.map((item, index) => checkJson(item, [...path, index]));
    const diagnostics = results.flatMap((item) => item.diagnostics);
    const values = results.flatMap((item) => (item.ok ? [item.value] : []));
    return values.length === results.length ? success(values, diagnostics) : failure(diagnostics);
  }
  if (isRecord(value)) {
    const results = Object.entries(value).map(([key, item]) => [key, checkJson(item, [...path, key])] as const);
    const diagnostics = results.flatMap(([, item]) => item.diagnostics);
    const entries = results.flatMap(([key, item]) => (item.ok ? [[key, item.value] as const] : []));
    return entries.length === results.length ? success(Object.fromEntries(entries), diagnostics) : failure(diagnostics);
  }
  return failure([diagnostic('mcp/not-json', `A ${typeof value} cannot travel as JSON.`, path)]);
};

// Accepts anything JSON can carry, and refuses what it cannot: a function, a symbol, `undefined`,
// a bigint, `NaN` and infinities. Used on everything that arrives over the bridge.
export const jsonValueSchema: Schema<JsonValue> = {
  check: checkJson,
  describe: () => ({ description: 'Any JSON value.' }),
  isOptional: false,
};

// A schema description as the JSON a client is sent: properties with nothing in them are absent
// rather than written as null, which is what `exactOptionalPropertyTypes` means on the wire.
export const jsonOf = (schema: JsonSchema): JsonRecord => {
  const entries: (readonly [string, JsonValue])[] = [];
  const put = (key: string, value: JsonValue | undefined): void => {
    if (value !== undefined) entries.push([key, value]);
  };
  const each = (items: readonly JsonSchema[] | undefined): JsonValue | undefined =>
    items === undefined ? undefined : items.map((item) => jsonOf(item));
  put('type', schema.type);
  put('description', schema.description);
  put(
    'properties',
    schema.properties === undefined
      ? undefined
      : Object.fromEntries(Object.entries(schema.properties).map(([key, item]) => [key, jsonOf(item)])),
  );
  put('required', schema.required === undefined ? undefined : [...schema.required]);
  put('items', schema.items === undefined ? undefined : jsonOf(schema.items));
  put('prefixItems', each(schema.prefixItems));
  put('additionalProperties', schema.additionalProperties === undefined ? undefined : jsonOf(schema.additionalProperties));
  put('minItems', schema.minItems);
  put('maxItems', schema.maxItems);
  put('anyOf', each(schema.anyOf));
  put('const', schema.const);
  put('enum', schema.enum === undefined ? undefined : [...schema.enum]);
  return Object.fromEntries(entries);
};

// The object schema of a tool's input, as it arrives over the bridge. A description that is not an
// object schema is refused here rather than handed to a client that cannot call it.
export const toolInputSchema: Schema<ToolInputSchema> = mapped(
  refine(
    record(jsonValueSchema),
    (value) => value['type'] === 'object',
    'mcp/not-an-object-schema',
    'A tool input schema must describe an object.',
  ),
  (value): ToolInputSchema => ({ ...value, type: 'object' }),
);

// The tool name a command name becomes. MCP names hold letters, digits, underscore and hyphen only.
export const toolName = (command: string): string => command.replace(/[^A-Za-z0-9_-]/g, '_');

// One tool, and the command it dispatches. `command` is the bridge's own field: `listedTool` is what
// an MCP client is shown.
export type McpTool = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly command: string;
  readonly inputSchema: ToolInputSchema;
};

// What an MCP client is shown: name, title, description and input schema, without the command.
export type ListedTool = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: ToolInputSchema;
};

// A tool as it arrives over the bridge from the session that owns the commands.
export const mcpToolSchema: Schema<McpTool> = object({
  name: string(),
  title: string(),
  description: string(),
  command: string(),
  inputSchema: toolInputSchema,
});

// What an MCP client is shown: the tool without the command name behind it.
export const listedTool = (tool: McpTool): ListedTool => ({
  name: tool.name,
  title: tool.title,
  description: tool.description,
  inputSchema: tool.inputSchema,
});

// The tool of that name, or nothing when no tool has it.
export const toolNamed = (tools: readonly McpTool[], name: string): McpTool | undefined =>
  tools.find((tool) => tool.name === name);

// The tools for a session's commands, in the order the commands were registered.
//
// A command whose input is not an object is not offered: MCP tool arguments are a named record, so
// a positional or scalar input has no honest tool shape. That is a warning, not a failure - the
// other commands are still usable. Two commands whose names collapse to one tool name is an error,
// because either tool would then dispatch the wrong command.
export const toolsFromCommands = (descriptors: readonly CommandDescriptor[]): Result<readonly McpTool[]> => {
  const diagnostics: Diagnostic[] = [];
  const tools: McpTool[] = [];
  for (const item of descriptors) {
    const schema = item.inputSchema;
    if (schema.type !== 'object') {
      diagnostics.push(
        warning(
          'mcp/not-an-object-input',
          `Command ${item.name} does not take an object, so it is not offered as a tool.`,
          ['commands', item.name],
        ),
      );
      continue;
    }
    const name = toolName(item.name);
    const clash = toolNamed(tools, name);
    if (clash !== undefined) {
      diagnostics.push(
        diagnostic('mcp/repeated-tool', `Commands ${clash.command} and ${item.name} both become the tool ${name}.`, [
          'commands',
          item.name,
        ]),
      );
      continue;
    }
    tools.push({
      name,
      title: item.title,
      description: item.description,
      command: item.name,
      inputSchema: { ...jsonOf(schema), type: 'object' },
    });
  }
  return resultOf(tools, diagnostics);
};
