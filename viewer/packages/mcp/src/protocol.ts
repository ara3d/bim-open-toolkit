// The three messages a browser session and the bridge exchange. Pure: no transport, no SDK.
//
// The browser holds the session, so it holds the truth about which commands exist. It builds its
// own tool list with `toolsFromCommands` and sends it; the bridge holds that list and forwards
// calls by tool name. Nothing on the bridge side ever names a command, which is why a connection
// to the bridge cannot reach anything the session did not register.

import {
  array,
  boolean,
  diagnostic,
  failure,
  literal,
  object,
  parse,
  string,
  success,
  union,
  type Result,
  type Schema,
} from '@bim-open-toolkit/model';
import type { ToolResponse } from './dispatch.js';
import { jsonValueSchema, mcpToolSchema, type JsonValue, type McpTool } from './tools.js';

// The protocol this package speaks. A session announcing a different one is refused, not adapted.
export const bridgeProtocol = 'bim-open-toolkit/mcp/1';

// The session announcing what it can do. Sent on connection and again whenever features change.
export type ToolsMessage = { readonly kind: 'tools'; readonly protocol: string; readonly tools: readonly McpTool[] };

// The bridge asking the session to run one tool.
export type CallMessage = { readonly kind: 'call'; readonly id: string; readonly tool: string; readonly input: JsonValue };

// The session's answer to one call.
export type ResponseMessage = { readonly kind: 'response'; readonly id: string; readonly response: ToolResponse };

// Everything that travels over the bridge socket.
export type BridgeMessage = ToolsMessage | CallMessage | ResponseMessage;

const toolContentSchema = object({ type: literal('text'), text: string() });

// A tool response as it travels: the session formats it, so both sides format failures alike.
export const toolResponseSchema: Schema<ToolResponse> = object({
  content: array(toolContentSchema),
  isError: boolean(),
});

export const toolsMessageSchema: Schema<ToolsMessage> = object({
  kind: literal('tools'),
  protocol: string(),
  tools: array(mcpToolSchema),
});

export const callMessageSchema: Schema<CallMessage> = object({
  kind: literal('call'),
  id: string(),
  tool: string(),
  input: jsonValueSchema,
});

export const responseMessageSchema: Schema<ResponseMessage> = object({
  kind: literal('response'),
  id: string(),
  response: toolResponseSchema,
});

// Any of the three, chosen by its `kind`.
export const bridgeMessageSchema: Schema<BridgeMessage> = union<BridgeMessage>(
  toolsMessageSchema,
  callMessageSchema,
  responseMessageSchema,
);

// A message as the text a socket carries.
export const writeMessage = (message: BridgeMessage): string => JSON.stringify(message);

// The value some text holds, or a diagnostic saying it is not JSON at all.
const readJson = (text: string): Result<unknown> => {
  try {
    const value: unknown = JSON.parse(text);
    return success(value);
  } catch {
    return failure([diagnostic('mcp/not-json', 'The bridge received text that is not JSON.')]);
  }
};

// The message that text holds. Text that is not JSON, and JSON that is not one of the three
// messages, is a diagnostic; neither side ever acts on what it could not read.
export const readMessage = (text: string): Result<BridgeMessage> => {
  const parsed = readJson(text);
  return parsed.ok ? parse(bridgeMessageSchema, parsed.value) : failure(parsed.diagnostics);
};
