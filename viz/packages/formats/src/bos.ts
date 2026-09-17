import { bosToBfast } from '@ara3d/viewer-loaders';
import { readBfastModel, type BfastOptions } from './bfast.js';
import { fail, formatCode } from './diagnostics.js';
import { loadedModel, type LoadedModel } from './loaded-model.js';
import { reportProgress, throwIfCancelled } from './progress.js';

/**
 * Turns a BOS archive into BFAST bytes. The loaders package supplies the one this uses; the seam
 * exists so the composition below can be tested without a real archive.
 */
export type BosConverter = (input: ArrayBuffer) => Promise<ArrayBuffer>;

// The conversion used unless a caller supplies its own. Retains every original Parquet entry.
export const defaultBosConverter: BosConverter = bosToBfast;

export type BosOptions = BfastOptions & { readonly convert?: BosConverter };

/**
 * A BOS archive as a `LoadedModel`, by converting it to BFAST and taking the BFAST path.
 *
 * BFAST is the default format across V2 (decision 2026-09-07), so BOS has one adapter rather than a
 * second geometry reader: everything below the conversion is shared, and the two paths cannot drift.
 * The result differs from loading the converted file directly only in `format` and `sourceBytes`,
 * which describe what the caller supplied.
 *
 * Raises a `FormatError`; `loadModel` is the entry that returns failures instead of raising them.
 */
export async function readBosModel(buffer: ArrayBuffer, options: BosOptions = {}): Promise<LoadedModel> {
  throwIfCancelled(options);
  reportProgress(options, 'parse', 0, 2);
  const convert = options.convert ?? defaultBosConverter;
  const prepared = await convert(buffer).catch((error: unknown): never =>
    fail(formatCode.invalidBos, `The BOS archive could not be prepared: ${messageOf(error)}`),
  );
  throwIfCancelled(options);
  reportProgress(options, 'parse', 1, 2);
  const model = await readBfastModel(prepared, options);
  return loadedModel('bos', model.data, model.geometry, buffer.byteLength, model.diagnostics, {
    ...(model.properties === undefined ? {} : { properties: model.properties }),
    ...(model.documents === undefined ? {} : { documents: model.documents }),
  });
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));
