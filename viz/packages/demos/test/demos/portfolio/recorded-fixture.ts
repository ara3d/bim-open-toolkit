// A model carrying recorded properties and source documents, built by hand so the roll-up can be
// checked against numbers stated here rather than against a private hundred-megabyte file.
//
// The tables are the shapes `@bim-open-toolkit/formats` decodes: descriptors whose labels are
// string-pool indices, parameter rows of entity, descriptor and one raw value word, and a document
// per entity. They go through the package's own `modelPropertiesFrom` and `modelDocumentsFrom`, so
// what the demo reads here it reads exactly as it reads a real file.
//
// The twelve objects cover every case the roll-up has to tell apart: a figure recorded, a figure
// recorded as zero, no figure at all, one object recording two figures that disagree, a document
// recording no figure, a document recording one quantity in two units, and an object the file
// attributes to no document.

import {
  modelDocumentsFrom,
  modelPropertiesFrom,
  type ModelDocuments,
  type ModelProperties,
} from '@bim-open-toolkit/formats';
import {
  emptyInstances,
  emptyObject,
  metresZUpLocal,
  objectRef,
  translation,
  type Geometry,
  type ModelData,
  type ModelRef,
  type ObjectRecord,
} from '@bim-open-toolkit/model';
import { openedModel } from '../../../src/gallery/model-source.js';
import type { OpenedModel } from '../../../src/gallery/contracts.js';

// The string pool the descriptor and document labels index into. Index 0 is empty, which the
// decoder reads as no label at all.
const strings: readonly string[] = [
  '',
  'Area',
  'SQUARE_FEET',
  'Dimensions',
  'Volume',
  'CUBIC_FEET',
  'US_GALLONS',
  'Mechanical',
  'Architectural',
  'Structural',
  'Landscape',
  'arch.rvt',
  'struct.rvt',
  'land.rvt',
];

// `ParameterType` ordinal 1 is a number: the value word indexes the number pool.
const numberType = 1;

// Area in square feet, volume in cubic feet, and volume in US gallons - the same quantity name
// recorded in two different units, which is what a real federated file does.
const descriptors: readonly Readonly<Record<string, unknown>>[] = [
  { Name: 1, Units: 2, Group: 3, Type: numberType },
  { Name: 4, Units: 5, Group: 3, Type: numberType },
  { Name: 4, Units: 6, Group: 7, Type: numberType },
];

// Which descriptor each figure below is recorded under.
const areaDescriptor = 0;
const cubicFeetDescriptor = 1;
const gallonsDescriptor = 2;

// One recorded figure: the object it is on, the descriptor it is under, and its value.
type Figure = { readonly object: number; readonly descriptor: number; readonly value: number };

// The document each object belongs to, -1 for the one the file attributes to none.
export const documentOfObject: readonly number[] = [0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, -1];

// Every figure the fixture records. Object 7 carries two areas that disagree; object 2 carries an
// area recorded as exactly zero; objects 3, 4, 8, 9 and 10 carry no area at all.
export const figures: readonly Figure[] = [
  { object: 0, descriptor: areaDescriptor, value: 100 },
  { object: 0, descriptor: cubicFeetDescriptor, value: 20 },
  { object: 1, descriptor: areaDescriptor, value: 250 },
  { object: 2, descriptor: areaDescriptor, value: 0 },
  { object: 3, descriptor: cubicFeetDescriptor, value: 5 },
  { object: 5, descriptor: areaDescriptor, value: 40 },
  { object: 5, descriptor: cubicFeetDescriptor, value: 7 },
  { object: 6, descriptor: areaDescriptor, value: 60 },
  { object: 6, descriptor: gallonsDescriptor, value: 3 },
  { object: 7, descriptor: areaDescriptor, value: 30 },
  { object: 7, descriptor: areaDescriptor, value: 31 },
  { object: 10, descriptor: cubicFeetDescriptor, value: 1 },
  { object: 11, descriptor: areaDescriptor, value: 999 },
];

// What the fixture states, so a test asserts against one place rather than recomputing it.
export const expected = {
  objects: 12,
  documentTitles: ['Architectural', 'Structural', 'Landscape'] as const,
  areaUnit: 'SQUARE_FEET',
  // 350 in Architectural, 161 in Structural, none in Landscape, 999 on the object with no document.
  areaTotal: 1510,
  areaByDocument: [999, 350, 161] as const,
  areaObjects: 7,
  areaWithout: 5,
  areaZeros: 1,
  unattributed: 1,
  volumeUnits: ['CUBIC_FEET', 'US_GALLONS'] as const,
  volumeCubicFeet: 33,
  volumeGallons: 3,
  resolved: 5,
  conflicting: 1,
  missing: 5,
  excluded: 1,
} as const;

const modelRef: ModelRef = { id: 'recorded', revision: '1' };

const objectId = (index: number): string => `object-${String(index)}`;

// Twelve objects, each at its own point so the box of each document is its own.
const records: readonly ObjectRecord[] = Array.from({ length: expected.objects }, (_unused, index) => ({
  ...emptyObject(objectRef(modelRef, objectId(index))),
  name: objectId(index),
  category: index % 2 === 0 ? 'Walls' : 'Floors',
  transform: translation([index * 10, index * 10, 0]),
}));

export const recordedModelData: ModelData = {
  ref: modelRef,
  coordinates: metresZUpLocal,
  objects: records,
};

// No mesh draws any of it, so every object's box is the point its own transform places it at, which
// is exactly the fallback the roll-up uses on a real object that draws nothing.
export const recordedGeometry: Geometry = { meshes: [], instances: emptyInstances(0) };

const identityColumn = (length: number): Int32Array =>
  Int32Array.from({ length }, (_unused, index) => index);

// The parameter tables as the loader hands them over.
export const recordedProperties = (): ModelProperties =>
  modelPropertiesFrom({
    descriptors,
    parameters: figures.map((figure, index) => ({
      Entity: figure.object,
      Descriptor: figure.descriptor,
      Value: index,
    })),
    numbers: figures.map((figure) => ({ Numbers: figure.value })),
    points: [],
    strings,
    objectOfEntity: identityColumn(expected.objects),
    objects: expected.objects,
  });

// The document table as the loader hands it over.
export const recordedDocuments = (): ModelDocuments =>
  modelDocumentsFrom(
    [
      { Title: 8, Path: 11 },
      { Title: 9, Path: 12 },
      { Title: 10, Path: 13 },
    ],
    strings,
    Int32Array.from(documentOfObject),
    identityColumn(expected.objects),
  );

// The whole thing as the gallery opens it, under whichever handle the caller wants it opened as.
export const recordedModel = (modelId = 'snowdon'): OpenedModel =>
  openedModel(modelId, recordedModelData, recordedGeometry, {
    properties: recordedProperties(),
    documents: recordedDocuments(),
  });
