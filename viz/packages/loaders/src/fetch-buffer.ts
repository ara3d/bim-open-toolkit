import { LoadProgress, LoadSource } from './progress.js';

/** Fetches a URL into an ArrayBuffer, reporting byte-level 'fetch' progress. */
export async function fetchArrayBuffer(
  url: string,
  onProgress?: (p: LoadProgress) => void,
): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  const header = res.headers.get('content-length');
  const total = header ? Number(header) : undefined;
  if (!res.body || !onProgress) {
    const buf = await res.arrayBuffer();
    onProgress?.({ stage: 'fetch', loaded: buf.byteLength, total: buf.byteLength });
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress({ stage: 'fetch', loaded, total });
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out.buffer;
}

/** Resolves any LoadSource to bytes (fetching when it is a URL). */
export async function toArrayBuffer(
  source: LoadSource,
  onProgress?: (p: LoadProgress) => void,
): Promise<ArrayBuffer> {
  if (typeof source === 'string') return fetchArrayBuffer(source, onProgress);
  if (source instanceof ArrayBuffer) return source;
  return source.arrayBuffer();
}
