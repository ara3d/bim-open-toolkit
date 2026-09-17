// The half a browser page mounts: it holds the session, joins the bridge, and answers tool calls.
//
// Nothing in this file imports Node. The socket is behind a four-callback interface so the page
// uses the browser's own `WebSocket` and a test uses whatever it has; `browserSocket` is the
// browser adapter and is the only place the DOM is named.
//
// The page is the authority on what exists. It builds the tool list from its own session's
// registered commands and sends it; a call that names a tool it did not send is refused here,
// before any command name is formed. That is the same rule the alpha's review tools had: only
// registered operations, inputs checked by the operation, and no way to say anything else.

import type { Result } from '@bim-open-toolkit/model';
import { callToolAsCommand, type ToolResponse } from './dispatch.js';
import type { CommandSession } from './headless-host.js';
import { bridgeProtocol, readMessage, writeMessage, type BridgeMessage } from './protocol.js';
import { toolsFromCommands, type McpTool } from './tools.js';

// A socket as this file uses one: send text, close, and be told about four things.
export type BridgeSocket = {
  readonly send: (text: string) => void;
  readonly close: () => void;
  readonly onOpen: (listener: () => void) => void;
  readonly onMessage: (listener: (text: string) => void) => void;
  readonly onClose: (listener: (reason: string) => void) => void;
  readonly onError: (listener: (message: string) => void) => void;
};

// The address `startBridge` listens on by default, which is the port the plan reserved.
export const defaultBridgeUrl = 'ws://127.0.0.1:5174';

// The browser's own WebSocket behind the socket interface. Binary frames are ignored: this
// protocol is text.
export const browserSocket = (url: string): BridgeSocket => {
  const socket = new WebSocket(url);
  return {
    send: (text) => {
      socket.send(text);
    },
    close: () => {
      socket.close();
    },
    onOpen: (listener) => {
      socket.onopen = (): void => listener();
    },
    onMessage: (listener) => {
      socket.onmessage = (event: MessageEvent<unknown>): void => {
        if (typeof event.data === 'string') listener(event.data);
      };
    },
    onClose: (listener) => {
      socket.onclose = (event: CloseEvent): void => listener(event.reason);
    },
    onError: (listener) => {
      socket.onerror = (): void => listener(`The connection to the bridge at ${url} failed.`);
    },
  };
};

// How a page joins a bridge.
export type BrowserBridgeOptions = {
  readonly session: CommandSession;
  readonly url?: string | undefined;
  // How to open the socket. The default is the browser's `WebSocket`; a test passes its own.
  readonly socket?: ((url: string) => BridgeSocket) | undefined;
  // Told what the connection did and what it could not read. Nothing is ever thrown at the page.
  readonly onNote?: ((note: string) => void) | undefined;
};

// A joined bridge. `refresh` re-reads the session's commands and sends the tool list again, which
// is what a page does after installing or removing a feature.
export type BridgeConnection = {
  readonly refresh: () => Result<readonly McpTool[]>;
  readonly tools: () => readonly McpTool[];
  readonly close: () => void;
};

// Joins the bridge and answers its calls from this session for as long as the socket is open.
export const connectBridge = (options: BrowserBridgeOptions): BridgeConnection => {
  const open = options.socket ?? browserSocket;
  const socket = open(options.url ?? defaultBridgeUrl);
  const note = options.onNote ?? ((): void => {});
  let tools: readonly McpTool[] = [];
  let joined = false;

  const send = (message: BridgeMessage): void => socket.send(writeMessage(message));

  const refresh = (): Result<readonly McpTool[]> => {
    const built = toolsFromCommands(options.session.commands.describe());
    tools = built.ok ? built.value : [];
    for (const item of built.diagnostics) note(`${item.severity} ${item.code}: ${item.message}`);
    if (joined) send({ kind: 'tools', protocol: bridgeProtocol, tools });
    return built;
  };

  const answer = (message: BridgeMessage): void => {
    if (message.kind !== 'call') {
      note(`The bridge sent a "${message.kind}" message, which a session does not answer.`);
      return;
    }
    const response: ToolResponse = callToolAsCommand(
      tools,
      options.session.dispatch,
      message.tool,
      message.input,
    );
    send({ kind: 'response', id: message.id, response });
  };

  socket.onOpen(() => {
    joined = true;
    refresh();
  });
  socket.onMessage((text) => {
    const message = readMessage(text);
    if (message.ok) answer(message.value);
    else for (const item of message.diagnostics) note(`${item.code}: ${item.message}`);
  });
  socket.onClose((reason) => {
    joined = false;
    note(reason === '' ? 'The bridge connection closed.' : `The bridge connection closed: ${reason}`);
  });
  socket.onError(note);

  return { refresh, tools: () => tools, close: () => socket.close() };
};
