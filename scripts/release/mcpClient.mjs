// A minimal MCP client over stdio, for the release smoke: starts the server, initializes, calls one
// tool, returns the text of its result, and stops the server.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

export function callMcpTool(command, args, tool, toolArguments, timeoutSeconds = 120) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const pending = new Map();
    let nextId = 1;
    const timer = setTimeout(() => finish(new Error(`${tool} timed out after ${timeoutSeconds} s`)), timeoutSeconds * 1000);
    const finish = (error, value) => {
      clearTimeout(timer);
      child.kill();
      error ? reject(error) : resolve(value);
    };
    const send = (message) => child.stdin.write(JSON.stringify(message) + "\n");
    const request = (method, params) => new Promise((done) => {
      const id = nextId++;
      pending.set(id, done);
      send({ jsonrpc: "2.0", id, method, params });
    });
    createInterface({ input: child.stdout }).on("line", (line) => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      pending.get(message.id)?.(message);
    });
    child.on("error", finish);
    (async () => {
      await request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "release-smoke", version: "1" } });
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      const reply = await request("tools/call", { name: tool, arguments: toolArguments });
      if (reply.error) return finish(new Error(`${tool}: ${JSON.stringify(reply.error)}`));
      finish(undefined, (reply.result?.content ?? []).map((c) => c.text ?? "").join("\n"));
    })().catch(finish);
  });
}
