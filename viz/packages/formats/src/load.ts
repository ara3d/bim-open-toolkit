import { success, type CoordinateContext, type Diagnostic, type ModelRef, type Result } from '@bim-open-toolkit/model';
import { defaultModelRef, readBfastModel, type MetadataLevel } from './bfast.js';
import { readBosModel, type BosConverter } from './bos.js';
import { detectFormat } from './detect.js';
import { diagnosticOf, formatCode, formatWarning, FormatError } from './diagnostics.js';
import { readGltfModel } from './gltf.js';
import { validateLoadedModel, type LoadedModel, type ModelFormat } from './loaded-model.js';
import { readObjModel } from './obj.js';
import { readBoxPreview, type BoxPreview } from './preview.js';
import { resolveSource, wholeBuffer, type ModelSource, type Resolver } from './resolver.js';
import { readStlModel } from './stl.js';
import { throwIfCancelled, type LoadContext } from './progress.js';

/** Everything `loadModel` accepts. Every field has a working default; only the source is required. */
export type LoadOptions = LoadContext & {
  /** Who the loaded model is. Defaults to the name the source arrived under. */
  readonly ref?: ModelRef;
  /** The frame to report in, when the caller knows better than the format does. */
  readonly coordinates?: CoordinateContext;
  /** Skips detection. Use it when the caller already knows, or the source has no name and no signature. */
  readonly format?: ModelFormat;
  /** How a document reaches a file it names but does not contain. */
  readonly resolver?: Resolver;
  /** How much of a BFAST or BOS model's embedded tables to decode. Defaults to everything. */
  readonly metadata?: MetadataLevel;
  /**
   * Decodes a BFAST or BOS model's parameter tables onto `LoadedModel.properties`. Off by default,
   * because a federated model carries over a million parameter rows and a caller who only wants to
   * draw it should not pay for them. See `properties.ts` for the measured cost.
   */
  readonly properties?: boolean;
  /** Runs `validateLoadedModel` over the result. Off by default: it costs as much as building it. */
  readonly validate?: boolean;
  /** How a BOS archive is prepared as BFAST. Defaults to the loaders' own conversion. */
  readonly convert?: BosConverter;
  /**
   * Called once, after the bytes are in hand and before parsing, with a box preview when the format
   * carries one (a prepared BFAST). Awaited, so a host can draw it and let the browser present a frame.
   * A preview that cannot be read becomes a `formats/no-preview` warning; the load goes on.
   */
  readonly onPreview?: (preview: BoxPreview) => void | Promise<void>;
};

/**
 * The one entry: any supported file, from anywhere, as one `LoadedModel`.
 *
 * Detects the format, reports progress, stops when the caller's signal aborts, and returns its
 * failures as diagnostics. Nothing it does throws, including a cancellation, so a host can treat one
 * failed model as data rather than as an exception to catch.
 */
export async function loadModel(source: ModelSource, options: LoadOptions = {}): Promise<Result<LoadedModel>> {
  try {
    const resolved = await resolveSource(source, options);
    const detected = options.format === undefined ? detectFormat(resolved.bytes, resolved.name) : success(options.format);
    if (!detected.ok) return detected;
    const previewDiagnostics = await runPreview(detected.value, resolved.bytes, options);
    const model = await readModel(detected.value, resolved.bytes, {
      ...options,
      ref: options.ref ?? defaultModelRef(resolved.name),
    });
    const problems = options.validate === true ? validateLoadedModel(model) : [];
    const diagnostics: readonly Diagnostic[] = [
      ...detected.diagnostics,
      ...previewDiagnostics,
      ...model.diagnostics,
      ...problems,
    ];
    return problems.some((each) => each.severity === 'error')
      ? { ok: false, diagnostics }
      : success(model, diagnostics);
  } catch (error) {
    return { ok: false, diagnostics: [diagnosticOf(error, formatCode.failed)] };
  }
}

/**
 * Offers `options.onPreview` a box preview of a BFAST before the full parse, once the bytes are in
 * hand. Every other format is left alone: only a BFAST carries the stored instance boxes a preview
 * reads. A preview that cannot be read, or a host callback that throws, becomes a `formats/no-preview`
 * warning and the load goes on; a cancellation raised while it runs propagates, so the load ends up
 * reporting `formats/cancelled` like every other cancellation.
 */
async function runPreview(
  format: ModelFormat,
  bytes: Uint8Array,
  options: LoadOptions,
): Promise<readonly Diagnostic[]> {
  if (format !== 'bfast' || options.onPreview === undefined) return [];
  try {
    const preview = readBoxPreview(bytes);
    await options.onPreview(preview);
    throwIfCancelled(options);
    return [];
  } catch (error) {
    if (error instanceof FormatError && error.code === formatCode.cancelled) throw error;
    return [formatWarning(formatCode.noPreview, error instanceof Error ? error.message : String(error))];
  }
}

/**
 * One named format as a `LoadedModel`, without detection.
 *
 * Raises a `FormatError` on anything it cannot read. `loadModel` is the entry that reports rather
 * than raises; this is what it dispatches through, and what a host uses when it already knows.
 */
export function readModel(format: ModelFormat, bytes: Uint8Array, options: LoadOptions = {}): Promise<LoadedModel> {
  switch (format) {
    case 'bfast':
      return readBfastModel(wholeBuffer(bytes), options);
    case 'bos':
      return readBosModel(wholeBuffer(bytes), options);
    case 'glb':
    case 'gltf':
      return readGltfModel(bytes, options);
    case 'obj':
      return Promise.resolve(readObjModel(bytes, options));
    case 'stl':
      return Promise.resolve(readStlModel(bytes, options));
  }
}
