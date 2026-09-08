import { fail, formatCode, FormatError } from './diagnostics.js';
import { reportProgress, throwIfCancelled, type LoadContext } from './progress.js';

// Anything a model can be loaded from: a URL to fetch, or bytes already in hand.
export type ModelSource = string | URL | ArrayBuffer | ArrayBufferView | Blob;

// Bytes plus whatever name they arrived under, which is what format detection falls back to.
export type ResolvedBytes = {
  readonly bytes: Uint8Array;
  readonly name: string | undefined;
};

/**
 * How a host supplies a file that a model refers to but does not contain, such as the `.bin` buffer
 * of a `.gltf`. Formats never fetch such a reference themselves: an unresolved reference is an error
 * naming the uri, so a host decides what its models are allowed to reach.
 */
export type Resolver = {
  readonly resolve: (uri: string, context: LoadContext) => Promise<ArrayBuffer>;
};

// Refuses every reference, naming it. The default, so nothing is fetched without a host saying so.
export const noResolver: Resolver = {
  resolve: (uri: string): Promise<ArrayBuffer> =>
    Promise.reject(
      new FormatError(
        formatCode.unresolvedResource,
        `The model refers to "${uri}", and no resolver was supplied to fetch it`,
        [uri],
      ),
    ),
};

// Resolves references from bytes the host already holds, keyed by the uri the model uses.
export const mapResolver = (entries: Iterable<readonly [string, ArrayBuffer]>): Resolver => {
  const table = new Map(entries);
  return {
    resolve: (uri: string): Promise<ArrayBuffer> => {
      const found = table.get(uri);
      return found === undefined
        ? Promise.reject(
            new FormatError(formatCode.unresolvedResource, `No resource supplied for "${uri}"`, [uri]),
          )
        : Promise.resolve(found);
    },
  };
};

// Resolves references by fetching them, relative to `base` when the reference is relative.
export const fetchResolver = (base?: string): Resolver => ({
  resolve: (uri: string, context: LoadContext): Promise<ArrayBuffer> =>
    fetchBytes(base === undefined ? uri : new URL(uri, base).toString(), context),
});

// The name a source arrived under, for format detection and for messages.
export function sourceName(source: ModelSource): string | undefined {
  if (typeof source === 'string') return source;
  if (source instanceof URL) return source.toString();
  if (typeof File !== 'undefined' && source instanceof File) return source.name;
  return undefined;
}

// The bytes of any source, fetching when it is a URL and reporting the fetch as it goes.
export async function resolveSource(source: ModelSource, context: LoadContext): Promise<ResolvedBytes> {
  throwIfCancelled(context);
  const name = sourceName(source);
  const bytes = await sourceBytes(source, context);
  if (bytes.byteLength === 0) fail(formatCode.emptySource, `The source${name === undefined ? '' : ` "${name}"`} has no bytes`);
  return { bytes, name };
}

async function sourceBytes(source: ModelSource, context: LoadContext): Promise<Uint8Array> {
  if (typeof source === 'string' || source instanceof URL)
    return new Uint8Array(await fetchBytes(source.toString(), context));
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (typeof Blob !== 'undefined' && source instanceof Blob) return new Uint8Array(await source.arrayBuffer());
  if (ArrayBuffer.isView(source)) return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  return fail(formatCode.emptySource, 'The source is not a URL, a buffer, a view or a blob');
}

/**
 * Fetches a whole file, reporting bytes received as `fetch` progress and stopping when the caller's
 * signal aborts. An HTML response is rejected by name, because a misrouted fixture server answering
 * a model request with its index page is the failure this catches most often.
 */
export async function fetchBytes(url: string, context: LoadContext): Promise<ArrayBuffer> {
  throwIfCancelled(context);
  const response = await fetch(url, context.signal === undefined ? {} : { signal: context.signal });
  if (!response.ok) fail(formatCode.fetchFailed, `Fetching "${url}" failed with status ${response.status}`, [url]);
  if (response.headers.get('content-type')?.includes('text/html') === true) {
    await response.body?.cancel();
    fail(formatCode.fetchFailed, `"${url}" answered with HTML, not model data`, [url]);
  }
  const declared = Number(response.headers.get('content-length'));
  const total = Number.isFinite(declared) && declared > 0 ? declared : undefined;
  if (response.body === null) {
    const whole = await response.arrayBuffer();
    reportProgress(context, 'fetch', whole.byteLength, total ?? whole.byteLength);
    return whole;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  try {
    for (;;) {
      throwIfCancelled(context);
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      reportProgress(context, 'fetch', loaded, total);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(loaded);
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk, at);
    at += chunk.byteLength;
  }
  return joined.buffer;
}

// The bytes as a standalone ArrayBuffer, copying only when they are a view into a larger one.
export const wholeBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer
    ? bytes.buffer
    : bytes.slice().buffer;
