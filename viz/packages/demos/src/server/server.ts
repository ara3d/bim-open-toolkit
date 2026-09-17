// The HTTP service. This file and main.ts are the only ones that perform network or stream IO;
// every decision it makes comes from the pure planner in plan.ts.

import { createReadStream } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { FixtureCatalog } from './catalog.js';
import { createIntegrityCache, type IntegrityCache } from './integrity.js';
import { planRequest, type RequestPlan } from './plan.js';
import {
  bytesHead,
  errorBody,
  errorHead,
  healthBody,
  infoBody,
  jsonHead,
  listBody,
  type ResponseHead,
} from './respond.js';
import { scanFixtures } from './scan.js';

// A running fixture server: where to reach it, the port it bound, and a close that releases both.
export type FixtureServer = {
  readonly url: string;
  readonly port: number;
  readonly close: () => Promise<void>;
};

// How to start a fixture server. The defaults bind the loopback address on a free port, so tests
// never collide with each other or with a gallery.
export type FixtureServerOptions = {
  readonly dirs: readonly string[];
  readonly host?: string;
  readonly port?: number;
};

const DEFAULT_HOST = '127.0.0.1';

const UNREADABLE = errorBody('fixture_unreadable', 'The fixture could not be read from disk.');

const send = (response: ServerResponse, head: ResponseHead, body: string | null): void => {
  response.writeHead(head.status, head.headers);
  if (body === null) response.end();
  else response.end(body);
};

const sendJson = (response: ServerResponse, headOnly: boolean, status: number, body: string): void =>
  send(response, jsonHead(status, body), headOnly ? null : body);

// Streams one slice of a file. Headers are written when the file opens, so a file that vanished
// between the scan and the request still produces a JSON 404 rather than a truncated 200.
const sendFile = (response: ServerResponse, head: ResponseHead, path: string, start: number, end: number): void => {
  const stream = createReadStream(path, { start, end });
  stream.once('open', () => response.writeHead(head.status, head.headers));
  stream.on('error', () => {
    if (response.headersSent) response.destroy();
    else sendJson(response, false, 404, UNREADABLE);
  });
  response.on('close', () => stream.destroy());
  stream.pipe(response);
};

const runPlan = async (
  catalog: FixtureCatalog,
  digest: IntegrityCache,
  plan: RequestPlan,
  headOnly: boolean,
  response: ServerResponse,
): Promise<void> => {
  switch (plan.kind) {
    case 'health':
      return sendJson(response, headOnly, 200, healthBody(catalog));
    case 'list':
      return sendJson(response, headOnly, 200, listBody(catalog));
    case 'info': {
      const sha256 = await digest(plan.entry).then(
        (value) => value,
        () => null,
      );
      return sha256 === null
        ? sendJson(response, headOnly, 404, UNREADABLE)
        : sendJson(response, headOnly, 200, infoBody(plan.entry, sha256));
    }
    case 'error': {
      const body = errorBody(plan.error, plan.reason);
      return send(response, errorHead(plan, body), headOnly ? null : body);
    }
    case 'bytes': {
      const head = bytesHead(plan.entry, plan.range);
      if (headOnly || plan.entry.bytes === 0) return send(response, head, null);
      const start = plan.range === null ? 0 : plan.range.start;
      const end = plan.range === null ? plan.entry.bytes - 1 : plan.range.end;
      return sendFile(response, head, plan.entry.path, start, end);
    }
  }
};

const handle = (
  catalog: FixtureCatalog,
  digest: IntegrityCache,
  request: IncomingMessage,
  response: ServerResponse,
): void => {
  const method = request.method ?? '';
  const plan = planRequest(catalog, {
    method,
    target: request.url ?? '/',
    rangeHeader: request.headers.range ?? null,
  });
  void runPlan(catalog, digest, plan, method === 'HEAD', response).catch(() => response.destroy());
};

const listen = (server: Server, host: string, port: number): Promise<void> =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

const boundPort = (server: Server): number | null => {
  const address = server.address();
  return address === null || typeof address === 'string' ? null : address.port;
};

// Closes the listener and drops keep-alive connections so the port is free immediately. Closing an
// already closed server does nothing.
const closeServer = (server: Server): Promise<void> =>
  server.listening
    ? new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error === undefined || error === null ? resolve() : reject(error)));
      })
    : Promise.resolve();

// Starts a fixture server over the given directories. The catalog is read once, before listening,
// so every served request is answered from a fixed set of names.
export const createFixtureServer = async (options: FixtureServerOptions): Promise<FixtureServer> => {
  const catalog = await scanFixtures(options.dirs);
  const digest = createIntegrityCache();
  const server = createServer((request, response) => handle(catalog, digest, request, response));
  const host = options.host ?? DEFAULT_HOST;
  await listen(server, host, options.port ?? 0);
  const port = boundPort(server);
  if (port === null) {
    await closeServer(server);
    throw new Error('The fixture server did not report a bound port.');
  }
  return { url: `http://${host}:${port}`, port, close: () => closeServer(server) };
};
