// The bridge without a bridge: a session in this process exposed as a tool host.
//
// The WebSocket half exists because a session normally lives in a browser page. Nothing about the
// tools or the dispatch needs that, so the same two pure halves over an in-process session give a
// host the MCP server can serve, and a walkthrough or a test can drive with no browser, no socket
// and no ports. This is what makes the door review demonstration runnable in Node.

import type { CommandDescriptor, Result } from '@bim-open-toolkit/model';
import { callToolAsCommand, toolResponse, type ToolHost, type ToolResponse } from './dispatch.js';
import { toolsFromCommands, type JsonValue, type McpTool } from './tools.js';

// What this package needs of a session: the commands it has now, and a way to run one.
// `ViewerSession` from `@bim-open-toolkit/viewer` satisfies it, and so does a test's fake.
export type CommandSession = {
  readonly commands: { readonly describe: () => readonly CommandDescriptor[] };
  readonly dispatch: (name: string, input: unknown) => Result<unknown>;
};

// A host over a session in this process. The tool list is rebuilt on every call, so a feature
// installed or removed after the host was made is reflected without anything being told.
export const headlessHost = (session: CommandSession): ToolHost => {
  const tools = (): Result<readonly McpTool[]> => toolsFromCommands(session.commands.describe());
  const call = (name: string, input: JsonValue): ToolResponse => {
    const built = tools();
    return built.ok ? callToolAsCommand(built.value, session.dispatch, name, input) : toolResponse(built);
  };
  return {
    listTools: () => Promise.resolve(tools()),
    callTool: (name, input) => Promise.resolve(call(name, input)),
    close: () => Promise.resolve(),
  };
};
