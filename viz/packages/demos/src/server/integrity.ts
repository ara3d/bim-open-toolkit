// SHA-256 of fixture files, computed once per file and kept for the life of the server.

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import type { FixtureEntry } from './catalog.js';

// SHA-256 of a file as lower-case hex, read in chunks so a large model is never held in memory.
export const hashFile = async (path: string): Promise<string> => {
  const hash = createHash('sha256');
  const chunks: AsyncIterable<Uint8Array> = createReadStream(path);
  for await (const chunk of chunks) hash.update(chunk);
  return hash.digest('hex');
};

// Returns the digest of a fixture, computing it at most once.
export type IntegrityCache = (entry: FixtureEntry) => Promise<string>;

// Caches one digest per fixture path. Concurrent callers share a single read of the file; a read
// that fails is not cached, so a later request retries it.
export const createIntegrityCache = (): IntegrityCache => {
  const digests = new Map<string, Promise<string>>();
  return (entry) => {
    const cached = digests.get(entry.path);
    if (cached !== undefined) return cached;
    const pending = hashFile(entry.path);
    digests.set(entry.path, pending);
    void pending.catch(() => digests.delete(entry.path));
    return pending;
  };
};
