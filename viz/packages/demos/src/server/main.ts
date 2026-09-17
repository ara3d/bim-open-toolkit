// Entry point of the fixture server: the only file that reads ambient environment variables.
//
//   V2_FIXTURES_DIRS  semicolon-separated directories to serve (default: DEFAULT_FIXTURE_DIRS)
//   V2_FIXTURES_HOST  interface to bind (default: 127.0.0.1)
//   V2_FIXTURES_PORT  port to bind, 0 for any free port (default: 5175)

import { DEFAULT_FIXTURE_DIRS, parseFixtureDirs, parsePort } from './config.js';
import { createFixtureServer } from './server.js';

const dirs = parseFixtureDirs(process.env.V2_FIXTURES_DIRS ?? null, DEFAULT_FIXTURE_DIRS);
const host = process.env.V2_FIXTURES_HOST ?? '127.0.0.1';
const port = parsePort(process.env.V2_FIXTURES_PORT ?? null, 5175);

const server = await createFixtureServer({ dirs, host, port });
process.stdout.write(`${JSON.stringify({ url: server.url, port: server.port, dirs })}\n`);

const shutdown = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
