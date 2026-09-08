// The sidebar sheet for the estate, or for the one building the reader has drilled into.
//
// The rule this demo exists for is that a source document is not a building. So the documents group
// lists every document by name and says what it maps to: one building, several, or none at all. A
// document nobody has filed stays in the list, named, rather than disappearing because no figure
// could be attributed through it.

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

// The line every sheet of this demo carries: what the data is and what the workflow will not do
// with it.
export const portfolioBasis =
  'Synthetic estate. A figure is attributed to a building only through a document that names exactly one.';

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
