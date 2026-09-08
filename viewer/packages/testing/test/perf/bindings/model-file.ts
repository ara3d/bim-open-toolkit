/**
 * Finding the private benchmark model.
 *
 * The model is not in the repository and must never be. When it is absent the
 * benchmark prints why and skips; it never fails.
 *
 * The package has no `@types/node`, so the runtime is reached the way
 * `src/perf/memory.ts` reaches it: through `globalThis` with a checked shape.
 * `process.getBuiltinModule` gives synchronous access to `node:fs` without a
 * module specifier the compiler would have to resolve.
 */

/** The part of Node's `Buffer` result this module reads. */
interface FileBytes {
  readonly buffer: ArrayBuffer;
  readonly byteOffset: number;
  readonly byteLength: number;
}

interface FileSystem {
  readFileSync(path: string): FileBytes;
  existsSync(path: string): boolean;
}

interface ProcessLike {
  getBuiltinModule(id: string): unknown;
  env: Record<string, string | undefined>;
}

const isProcessLike = (value: unknown): value is ProcessLike =>
  typeof value === 'object' && value !== null
  && 'getBuiltinModule' in value && typeof value.getBuiltinModule === 'function'
  && 'env' in value && typeof value.env === 'object' && value.env !== null;

const isFileSystem = (value: unknown): value is FileSystem =>
  typeof value === 'object' && value !== null
  && 'readFileSync' in value && typeof value.readFileSync === 'function'
  && 'existsSync' in value && typeof value.existsSync === 'function';

const globals: object = globalThis;

const nodeProcess = (): ProcessLike | undefined => {
  const candidate = 'process' in globals ? globals.process : undefined;
  return isProcessLike(candidate) ? candidate : undefined;
};

const fileSystem = (): FileSystem | undefined => {
  const module = nodeProcess()?.getBuiltinModule('node:fs');
  return isFileSystem(module) ? module : undefined;
};

/** Environment variable naming the prepared model to benchmark. */
export const modelPathVariable = 'SNOWDON_BFAST_PATH';

/** Where the loader session writes the prepared model, when the variable is unset. */
export const defaultModelPath =
  'C:/Users/cdigg/git/bim-open-toolkit/viewer/packages/visualization/artifacts/bfast/snowdon-bim.bfast';

/** The path the benchmark would read. */
export const modelPath = (): string => nodeProcess()?.env[modelPathVariable] ?? defaultModelPath;

/** The model bytes, or the reason the benchmark cannot run. */
export function readBenchmarkModel(): { readonly buffer: ArrayBuffer } | { readonly reason: string } {
  const path = modelPath();
  const fs = fileSystem();
  if (fs === undefined) return { reason: 'no Node file system: the benchmark needs a Node runtime' };
  if (!fs.existsSync(path)) return { reason: `no model at ${path}; set ${modelPathVariable} to a prepared BFAST file` };
  const bytes = fs.readFileSync(path);
  const whole = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength;
  return { buffer: whole ? bytes.buffer : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}
