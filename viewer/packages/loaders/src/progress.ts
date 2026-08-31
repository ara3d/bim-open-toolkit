/** Loading pipeline stage: network fetch, format parse, scene conversion. */
export type LoadStage = 'fetch' | 'parse' | 'convert';

export interface LoadProgress {
  readonly stage: LoadStage;
  /** Units depend on stage: bytes for 'fetch', steps for 'parse'/'convert'. */
  readonly loaded: number;
  /** Total units when known (e.g. Content-Length, group count). */
  readonly total?: number;
}

export interface LoadOptions {
  readonly onProgress?: (progress: LoadProgress) => void;
}

/** A URL to fetch, or already-obtained bytes. */
export type LoadSource = string | ArrayBuffer | Blob;
