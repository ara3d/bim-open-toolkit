// A parameter table built by hand, so everything the inspector does with a recorded property can be
// tested without the hundred-megabyte private file.
//
// It is built through `modelPropertiesFrom`, the same decoder the loader runs, from rows shaped the
// way `Parameters.parquet` and `Descriptors.parquet` shape them: three integers per parameter row and
// four per descriptor, with every label an index into one string pool. Building it that way rather
// than filling the columns in directly is the point - the encodings the sheet has to be honest about
// are the encodings the file uses, and an empty string pooled at index 0, an entity index of -1 and a
// number index outside the pool are all written here exactly as an exporter writes them.

import {
  modelDocumentsFrom,
  modelPropertiesFrom,
  type ModelDocuments,
  type ModelProperties,
} from '@bim-open-toolkit/formats';

// The `ParameterType` ordinals, which is what a descriptor's `Type` holds.
export const kindOrdinal = { int: 0, number: 1, entity: 2, string: 3, point: 4 } as const;

// One descriptor as the file records it: a name, a unit, a group and which pool its value indexes.
export type DescriptorSpec = {
  readonly name: string;
  readonly units?: string;
  readonly group?: string;
  readonly kind: keyof typeof kindOrdinal;
};

// One parameter row. `value` is the raw word the file holds - a pool index, an object row, or the
// integer itself - and `text` is the shorthand for a string value, pooled as the file would pool it.
export type ParameterSpec = {
  readonly object: number;
  readonly descriptor: number;
  readonly value?: number;
  readonly text?: string;
};

// A pool of strings that reads the empty string at index 0, which is how an exporter writes
// "recorded, with nothing written in it" and what the decoder reads back as absent.
const pool = (): { readonly index: (text: string | undefined) => number; readonly texts: () => readonly (string | undefined)[] } => {
  const held: string[] = [];
  return {
    index: (text) => {
      if (text === undefined || text === '') return 0;
      const found = held.indexOf(text);
      if (found >= 0) return found + 1;
      held.push(text);
      return held.length;
    },
    texts: () => ['', ...held],
  };
};

// The properties a test names, decoded the way the loader decodes them. Entities are object rows one
// for one, so an entity value is the object row it names and -1 names nothing.
export const propertiesFixture = (
  objects: number,
  descriptors: readonly DescriptorSpec[],
  parameters: readonly ParameterSpec[],
  numbers: readonly number[] = [],
  points: readonly (readonly [number, number, number])[] = [],
): ModelProperties => {
  const strings = pool();
  const descriptorRows = descriptors.map((each) => ({
    Name: strings.index(each.name),
    Units: strings.index(each.units),
    Group: strings.index(each.group),
    Type: kindOrdinal[each.kind],
  }));
  const parameterRows = parameters.map((each) => ({
    Entity: each.object,
    Descriptor: each.descriptor,
    Value: each.text === undefined ? (each.value ?? 0) : strings.index(each.text),
  }));
  const objectOfEntity = new Int32Array(objects);
  for (let object = 0; object < objects; object += 1) objectOfEntity[object] = object;
  return modelPropertiesFrom({
    descriptors: descriptorRows,
    parameters: parameterRows,
    numbers: numbers.map((value) => ({ Numbers: value })),
    points: points.map((point) => ({ X: point[0], Y: point[1], Z: point[2] })),
    strings: strings.texts(),
    objectOfEntity,
    objects,
  });
};

// Source documents for a model whose objects are their own entities: `ofObject` comes out as the
// document each object row belongs to.
export const documentsFixture = (
  titles: readonly string[],
  paths: readonly string[],
  documentOfObjectRow: readonly number[],
): ModelDocuments => {
  const strings = pool();
  const rows = titles.map((title, at) => ({ Title: strings.index(title), Path: strings.index(paths[at]) }));
  return modelDocumentsFrom(
    rows,
    strings.texts(),
    Int32Array.from(documentOfObjectRow),
    Int32Array.from(documentOfObjectRow.map((_, object) => object)),
  );
};
