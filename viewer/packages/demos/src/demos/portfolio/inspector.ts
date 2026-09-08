// The sidebar sheet for the estate, or for the one building the reader has drilled into.
//
// The rule this demo exists for is that a source document is not a building. So the documents group
// lists every document by name and says what it maps to: one building, several, or none at all. A
// document nobody has filed stays in the list, named, rather than disappearing because no figure
// could be attributed through it.
//
// A model read from a file gets a different sheet, because none of the above is true of it: it has
// no documents table this demo can reach and no figure to attribute. Painting the estate's rows
// over it would be the fabrication the gallery forbids, so it gets its own counts and its own list
// of what is missing and why.

import { setsSlice } from '@bim-open-toolkit/features';
import type { Session } from '@bim-open-toolkit/model';
import {
  conflictingValue,
  knownNumber,
  knownValue,
  missingValue,
  propertyGroup,
  propertyRow,
  propertySheet,
  type PropertyGroup,
  type PropertyRow,
  type PropertySheet,
  type SheetTable,
} from '@bim-open-toolkit/ui-gratify';
import { resultRows, type WorkflowResult } from '@bim-open-toolkit/workflows';
import { exceptionsSheet, textTable } from '../_workflows/exceptions.js';
import { type EstateDocument, type PortfolioIndex } from './city.js';
import { buildingReadings, drilledBuildingId, rollupsOf, type BuildingReading } from './readings.js';
import { currentSubject, type ModelReading } from './snowdon.js';

// The line every sheet of this demo carries: what the data is and what the workflow will not do
// with it.
export const portfolioBasis =
  'Synthetic estate. A figure is attributed to a building only through a document that names exactly one.';

// The same line for the real model: what was read, and that the workflow was not run over it.
export const sourceBasis =
  'Read from the file. The drill-through is not run over it: nothing in it reports a figure, and no ' +
  'building is attributed one.';

// How many categories the sheet lists before it stops. The rest are counted, never dropped
// silently: the row above says how many there are altogether.
export const listedCategories = 10;

// Why the drill-through cannot run on a model loaded from a file, one row per thing it needs. Each
// reason names what is absent and where it would have to come from, so the row is a request rather
// than a shrug.
const drillThroughGroup = (): PropertyGroup =>
  propertyGroup('drill-through', 'What the drill-through needs, and what is here', [
    propertyRow(
      'buildings',
      'Buildings to roll up to',
      missingValue('the file declares no building and no site; this demo does not read one out of a level name'),
    ),
    propertyRow(
      'documents',
      'Documents that report figures',
      missingValue('the file records which source document each object came from; an object record does not carry it'),
    ),
    propertyRow(
      'figures',
      'Reported figures',
      missingValue('quantities live in parameter tables inside the file, which the loader does not decode'),
    ),
    propertyRow(
      'rollup',
      'Site rollup',
      missingValue('there is nothing to add up, and a total of zero would be a claim'),
    ),
  ]);

// What the file carries, counted off its object records.
const fileGroup = (reading: ModelReading): PropertyGroup =>
  propertyGroup('file', 'What the file carries', [
    propertyRow('origin', 'Read from', knownValue(reading.origin)),
    propertyRow('objects', 'Objects', knownNumber(reading.objects, undefined, 0)),
    propertyRow('named', 'Named', knownNumber(reading.named, undefined, 0)),
    propertyRow('categorised', 'With a category', knownNumber(reading.categorised, undefined, 0)),
    propertyRow('identified', 'With a source id', knownNumber(reading.identified, undefined, 0)),
    propertyRow('drawn', 'Drawn', knownNumber(reading.drawn, undefined, 0)),
    propertyRow('categories', 'Categories named', knownNumber(reading.categories.length, undefined, 0)),
  ]);

// The largest categories by how many records name them, which is the one thing about this model the
// demo can state without joining anything to anything.
const categoryGroup = (reading: ModelReading): PropertyGroup =>
  propertyGroup(
    'categories',
    `The ${String(Math.min(listedCategories, reading.categories.length))} largest categories`,
    reading.categories
      .slice(0, listedCategories)
      .map((item) => propertyRow(`category/${item.name}`, item.name, knownNumber(item.count, undefined, 0))),
  );

// The sheet for a model the demo did not generate: what it holds, and why the roll-up is not run.
export const sourceSheet = (title: string, reading: ModelReading): PropertySheet =>
  propertySheet(title, [fileGroup(reading), drillThroughGroup(), categoryGroup(reading)], sourceBasis);

// What one document maps to. Nothing mapped is a gap with the reason; more than one building is a
// disagreement listing the candidates. Neither is settled by picking one.
export const documentRow = (document: EstateDocument): PropertyRow => {
  if (document.buildingIds.length === 0)
    return propertyRow(
      document.documentId,
      document.name,
      missingValue('nobody has mapped this document to a building'),
    );
  const only = document.buildingIds[0];
  return propertyRow(
    document.documentId,
    document.name,
    document.buildingIds.length === 1 && only !== undefined
      ? knownValue(only)
      : conflictingValue([...document.buildingIds]),
  );
};

// What the estate holds and what the workflow made of it.
const estateGroup = (index: PortfolioIndex, result: WorkflowResult): PropertyGroup =>
  propertyGroup('estate', 'Estate', [
    propertyRow('metric', 'Metric requested', knownValue(index.metricName)),
    propertyRow('buildings', 'Buildings', knownNumber(index.input.buildings.length, undefined, 0)),
    propertyRow('documents', 'Documents', knownNumber(index.documents.length, undefined, 0)),
    propertyRow('resolved', 'Figures resolved', knownNumber(resultRows(result, 'drillThrough').length, undefined, 0)),
    propertyRow('unresolved', 'Figures unresolved', knownNumber(result.exceptions.length, undefined, 0)),
    propertyRow('sites', 'Sites with a rollup', knownNumber(rollupsOf(result).length, undefined, 0)),
  ]);

// What is known about one building: where it is, whether anybody surveyed it, and the figure the
// workflow could attribute to it through a document that names it alone.
const buildingGroup = (reading: BuildingReading): PropertyGroup =>
  propertyGroup('building', 'Building', [
    propertyRow('name', 'Name', knownValue(reading.name)),
    propertyRow('site', 'Site', knownValue(reading.siteId)),
    propertyRow(
      'registration',
      'Registration',
      reading.registration === 'geographic'
        ? knownValue('geographic')
        : missingValue('nobody surveyed this building'),
    ),
    ...(reading.readings.length === 0
      ? [propertyRow('figure', 'Figure', missingValue('no document that names this building alone reports it'))]
      : reading.readings.map((item) =>
          propertyRow(`figure/${item.documentId}`, `Figure via ${item.documentId}`, knownNumber(item.value, item.unit, 0)),
        )),
  ]);

// The tables the sheet shows: the figures that resolved, the site rollups, and the exceptions.
const sheetTables = (result: WorkflowResult): readonly SheetTable[] => [
  { id: 'drillThrough', title: 'Metrics by building', table: textTable(resultRows(result, 'drillThrough')) },
  { id: 'portfolioRollup', title: 'Site rollup', table: textTable(resultRows(result, 'portfolioRollup')) },
  exceptionsSheet(result),
];

// The sheet for the estate as the session stands. Drilling into a building narrows the sheet to
// that building without hiding what the estate as a whole could not decide.
export const portfolioSheet =
  (index: PortfolioIndex): ((session: Session) => PropertySheet) =>
  (session: Session): PropertySheet => {
  const subject = currentSubject();
  if (subject.kind === 'source') return sourceSheet(subject.title, subject.reading);
  const result = index.result;
  if (!result.ok)
    return propertySheet(
      'Portfolio',
      [
        propertyGroup(
          'diagnostics',
          'The workflow refused this input',
          result.diagnostics.map((item, at) => propertyRow(`d${at}`, item.code, knownValue(item.message))),
        ),
      ],
      portfolioBasis,
    );
  const drilled = drilledBuildingId(index, session.read(setsSlice).isolated);
  const reading = buildingReadings(index, result.value).find((item) => item.buildingId === drilled);
  return propertySheet(
    reading === undefined ? 'Estate portfolio' : reading.name,
    [
      ...(reading === undefined ? [] : [buildingGroup(reading)]),
      estateGroup(index, result.value),
      propertyGroup('documents', 'Documents and what they map to', index.documents.map(documentRow)),
    ],
    portfolioBasis,
    sheetTables(result.value),
  );
};
