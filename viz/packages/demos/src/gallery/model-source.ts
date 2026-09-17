// Turning any of the four `ModelSource` kinds into the same five pieces the scene binding and the
// style pass need. Pure apart from the fetch and the file read.
//
// The two derived pieces are the slice's finding in code: `buildInstanceTable` addresses rows by
// the object key of each object ordinal, and `resolveStyles` resolves everything to grey unless it
// is given the appearance each object was loaded with. Neither is produced by the package that owns
// the input, and forgetting the second fails silently and totally.

import {
  defaultAppearance,
  failure,
  objectKey,
  success,
  type Appearance,
  type ModelData,
  type ObjectKey,
  type Result,
} from '@bim-open-toolkit/model';
import { detectFormat, loadModel, type ModelDocuments, type ModelProperties } from '@bim-open-toolkit/formats';
import type { ModelSource, OpenedModel } from './contracts.js';

// The object key of each object ordinal, in the order `Geometry.instances.objectIndex` counts.
export const objectKeysOf = (model: ModelData): readonly ObjectKey[] =>
  model.objects.map((record) => objectKey(record.ref));

// The appearance each object carries in the model, or the grey fallback where it carries none.
export const baseAppearancesOf = (model: ModelData): ReadonlyMap<ObjectKey, Appearance> =>
  new Map(model.objects.map((record) => [objectKey(record.ref), record.appearance ?? defaultAppearance]));

// One opened model from its data and geometry, with the derived pieces filled in, and whatever the
// loader read of what the file records.
export const openedModel = (
  modelId: string,
  data: ModelData,
  geometry: OpenedModel['geometry'],
  recorded: { readonly properties?: ModelProperties | undefined; readonly documents?: ModelDocuments | undefined } = {},
): OpenedModel => ({
  modelId,
  ref: data.ref,
  data,
  geometry,
  keys: objectKeysOf(data),
  base: baseAppearancesOf(data),
  properties: recorded.properties,
  documents: recorded.documents,
});

// Reading the parameter tables costs about half a second and thirteen megabytes on a real model,
// and every demo in the gallery is about what is known rather than only about what is drawn, so the
// gallery always asks. A format that carries none says so in a diagnostic and loads as before.
export const galleryLoadOptions = { properties: true } as const;

// Everything a source comes to. A url is fetched and a file is read by `formats`; a format is
// detected from the bytes and from the name the file arrived under, so a picked `.bfast` with no
// recognisable signature is still read.
export const resolveModelSource = async (source: ModelSource): Promise<Result<OpenedModel>> => {
  if (source.kind === 'data') return success(openedModel(source.id, source.data, source.geometry));
  if (source.kind === 'loaded')
    return success(openedModel(source.id, source.model.data, source.model.geometry, source.model), source.model.diagnostics);
  if (source.kind === 'url') {
    const loaded = await loadModel(source.url, galleryLoadOptions);
    return loaded.ok
      ? success(openedModel(source.id, loaded.value.data, loaded.value.geometry, loaded.value), loaded.diagnostics)
      : failure(loaded.diagnostics);
  }
  const bytes = new Uint8Array(await source.file.arrayBuffer());
  const format = detectFormat(bytes, source.name);
  if (!format.ok) return failure(format.diagnostics);
  const loaded = await loadModel(bytes, { ...galleryLoadOptions, format: format.value });
  return loaded.ok
    ? success(openedModel(source.id, loaded.value.data, loaded.value.geometry, loaded.value), loaded.diagnostics)
    : failure(loaded.diagnostics);
};
