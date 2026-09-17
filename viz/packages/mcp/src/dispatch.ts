// A tool call as a command dispatch, and a `Result` as a tool response. Pure: no transport.
//
// The whole security model of this package is one line of this file: a tool call is looked up in a
// list of tools built from registered commands, and what it dispatches is that command with the
// arguments it was given. There is no path from a tool call to anything else - no evaluation, no
// file system, no command name taken from the caller - and the command validates its own input
// before it runs, so an argument that does not fit comes back as diagnostics rather than an effect.

import { formatPath, type Diagnostic, type Result } from '@bim-open-toolkit/model';
import { toolNamed, type JsonValue, type McpTool } from './tools.js';

// One block of a tool response. Text only: a viewer command's result is data, not an image.
export type ToolContent = { readonly type: 'text'; readonly text: string };

// What a tool call answers with. `isError` is the protocol's own flag, set when the command failed.
export type ToolResponse = { readonly content: readonly ToolContent[]; readonly isError: boolean };

// What the MCP server and the WebSocket bridge both are: a list of tools and a way to call one.
// Asynchronous because a browser session is a round trip away; the headless host resolves at once.
export type ToolHost = {
  readonly listTools: () => Promise<Result<readonly McpTool[]>>;
  readonly callTool: (name: string, input: JsonValue) => Promise<ToolResponse>;
  readonly close: () => Promise<void>;
};

// One block of text.
export const textContent = (text: string): ToolContent => ({ type: 'text', text });

// One diagnostic as a line: severity, code, the address inside the input, and the message.
export const diagnosticLine = (item: Diagnostic): string =>
  `${item.severity} ${item.code}${item.path.length === 0 ? '' : ` at ${formatPath(item.path)}`}: ${item.message}`;

// A command's value as text. A value that cannot be written as JSON is reported as that, rather
// than being half-written or thrown out of the response.
const describeValue = (value: unknown): string => {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2) ?? 'The command produced a value that JSON does not carry.';
  } catch {
    return 'The command produced a value that cannot be written as JSON.';
  }
};

// A result as a tool response: the value first, then every diagnostic as its own line, and
// `isError` exactly when the command failed. A warning on a successful command is reported and
// leaves `isError` false, because the command did run.
export const toolResponse = (result: Result<unknown>): ToolResponse => {
  const lines = [
    ...(result.ok ? [describeValue(result.value)] : ['The command did not run.']),
    ...result.diagnostics.map(diagnosticLine),
  ].filter((line) => line !== '');
  return { content: lines.map(textContent), isError: !result.ok };
};

// A response that says only what went wrong, for what no command was reached to report.
export const errorResponse = (message: string): ToolResponse => ({
  content: [textContent(message)],
  isError: true,
});

// A tool call as a dispatch of the command that tool stands for. A name that is not in the list is
// refused here, so an unknown tool never reaches a session and never becomes a command name.
export const callToolAsCommand = (
  tools: readonly McpTool[],
  dispatch: (command: string, input: JsonValue) => Result<unknown>,
  name: string,
  input: JsonValue,
): ToolResponse => {
  const tool = toolNamed(tools, name);
  return tool === undefined
    ? errorResponse(
        tools.length === 0
          ? `There is no tool named "${name}", and no tools are available.`
          : `There is no tool named "${name}". The tools are: ${tools.map((one) => one.name).join(', ')}.`,
      )
    : toolResponse(dispatch(tool.command, input));
};
