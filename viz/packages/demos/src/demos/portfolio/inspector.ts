// The sidebar sheet for the estate, or for the one building the reader has drilled into.
//
// The rule this demo exists for is that a source document is not a building. So the documents group
// lists every document by name and says what it maps to: one building, several, or none at all. A
// document nobody has filed stays in the list, named, rather than disappearing because no figure
// could be attributed through it.
//
// A model read from a file gets a different sheet, because the estate's rows are not true of it: it
// has its own documents, which are the source files federated into it, and its own figures, which
// are the quantities its parameter tables record. Painting the estate's rows over it would be the
// fabrication the gallery forbids, so it gets the roll-up its own file states - see `recorded.ts`
// for which question that is and why it is not this one - and, when the file carries no parameter
// table at all, a statement that it does not rather than a roll-up of nothing.

import { setsSlice } from '@bim-open-toolkit/features';
import { stringColumn, table, type Session } from '@bim-open-toolkit/model';
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
import type { DocumentRollup, RecordedRollup } from './recorded.js';
import { currentSubject, drilledDocument, type ModelReading } from './snowdon.js';

// The line every sheet of this demo carries: what the data is and what the workflow will not do
// with it.
export const portfolioBasis =
  'Synthetic estate. A figure is attributed to a building only through a document that names exactly one.';

// The same line for a model read from a file, which rolls up by the grouping the file records.
export const sourceBasis =
  'Read from the file. A figure is added up only within one recorded unit, and an object carrying no ' +
  'figure is counted as carrying none rather than as a zero.';

// The line for a file whose format carries no parameter table at all.
export const noPropertiesBasis =
  'Read from the file. It carries no parameter table and no document table, so there is nothing to roll up.';

// How many categories the sheet lists before it stops. The rest are counted, never dropped
// silently: the row above says how many there are altogether.
export const listedCategories = 10;

// Why the roll-up cannot run on a file whose format carries neither table. Each reason names what
// is absent and where it would have to come from, so the row is a request rather than a shrug.
const drillThroughGroup = (): PropertyGroup =>
  propertyGroup('drill-through', 'What the roll-up needs, and what is here', [
    propertyRow(
      'documents',
      'A grouping to roll up to',
      missingValue('this file names no source document for its objects, so there is nothing to group them by'),
    ),
    propertyRow(
      'figures',
      'Reported figures',
      missingValue('this file carries no parameter table, so no quantity was recorded against any object'),
    ),
    propertyRow(
      'rollup',
      'Roll-up',
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

// What the roll-up read and what it made of it. Every count here is of objects, so "records no
// figure" is a number of objects and never a total of zero.
const rollupGroup = (rollup: RecordedRollup): PropertyGroup => {
  const requested = rollup.requested;
  return propertyGroup('rollup', 'Roll-up', [
    propertyRow('metric', 'Metric added up', knownValue(rollup.requestedMetricName)),
    propertyRow(
      'total',
      'Total',
      requested.total === undefined || requested.unit === undefined
        ? conflictingValue(requested.byUnit.map((item) => `${item.total.toFixed(2)} ${item.unit}`))
        : knownNumber(requested.total, requested.unit, 2),
    ),
    propertyRow('documents', 'Source documents', knownNumber(rollup.documents.length, undefined, 0)),
    propertyRow('objects', 'Objects', knownNumber(rollup.objects, undefined, 0)),
    propertyRow('with', 'Objects recording it', knownNumber(requested.objects, undefined, 0)),
    propertyRow(
      'without',
      'Objects recording none',
      requested.without === 0
        ? knownNumber(0, undefined, 0)
        : missingValue(`${String(requested.without)} objects carry no ${rollup.requestedMetricName} row at all`),
    ),
    propertyRow('zeros', 'Of those recorded, exactly zero', knownNumber(requested.zeros, undefined, 0)),
    propertyRow(
      'unattributed',
      'Objects naming no source document',
      knownNumber(rollup.unattributed, undefined, 0),
    ),
    propertyRow('parameterRows', 'Parameter rows read', knownNumber(rollup.propertyRows, undefined, 0)),
    propertyRow('droppedRows', 'Parameter rows dropped', knownNumber(rollup.droppedRows, undefined, 0)),
  ]);
};

// One row per source document with what it adds up to, in the unit it was recorded in. A document
// recording none of the metric is a gap with the reason; one recording it in two units is a
// disagreement listing both totals, and neither is settled by picking one.
export const documentTotalRow = (document: DocumentRollup, metricName: string): PropertyRow => {
  const requested = document.requested;
  if (requested.byUnit.length === 0)
    return propertyRow(
      `document/${String(document.index)}`,
      document.title,
      missingValue(`no object of this document records a ${metricName}`),
    );
  if (requested.total === undefined || requested.unit === undefined)
    return propertyRow(
      `document/${String(document.index)}`,
      document.title,
      conflictingValue(requested.byUnit.map((item) => `${item.total.toFixed(2)} ${item.unit}`)),
    );
  return propertyRow(
    `document/${String(document.index)}`,
    document.title,
    knownNumber(requested.total, requested.unit, 2),
  );
};

const documentsGroup = (rollup: RecordedRollup): PropertyGroup =>
  propertyGroup(
    'source-documents',
    `${rollup.requestedMetricName} by source document`,
    rollup.documents.map((document) => documentTotalRow(document, rollup.requestedMetricName)),
  );

// The metrics beside the one being added up, and what stopped each from having one total. This is
// where a quantity the file records in two units stays visible as two units.
const otherMetricsGroup = (rollup: RecordedRollup): PropertyGroup =>
  propertyGroup(
    'other-metrics',
    'Other quantities the file records',
    rollup.metrics
      .filter((metric) => metric.metricName !== rollup.requestedMetricName)
      .map((metric) =>
        propertyRow(
          `metric/${metric.metricName}`,
          metric.metricName,
          metric.byUnit.length === 0
            ? missingValue('no object records it')
            : metric.byUnit.length > 1
              ? conflictingValue(
                  metric.byUnit.map((item) => `${item.total.toFixed(2)} ${item.unit} on ${String(item.objects)} objects`),
                )
              : knownNumber(metric.total ?? 0, metric.unit, 2),
        ),
      ),
  );

// What one drilled-into source document holds.
const drilledDocumentGroup = (document: DocumentRollup, metricName: string): PropertyGroup =>
  propertyGroup('document', 'Source document', [
    propertyRow('title', 'Title', knownValue(document.title)),
    propertyRow(
      'path',
      'Recorded path',
      document.path === undefined ? missingValue('the file records no path for it') : knownValue(document.path),
    ),
    propertyRow('objects', 'Objects', knownNumber(document.objects, undefined, 0)),
    documentTotalRow(document, metricName),
    propertyRow(
      'without',
      `Objects recording no ${metricName}`,
      document.requested.without === 0
        ? knownNumber(0, undefined, 0)
        : missingValue(`${String(document.requested.without)} of them carry no ${metricName} row`),
    ),
  ]);

// A figure as text for a table cell: two decimals, or empty when the file gives no single number.
// Empty rather than a dash or a zero, because a table cell that reads `0.00` is a measurement.
const figureCell = (value: number | undefined): string => (value === undefined ? '' : value.toFixed(2));

// The two tables the roll-up sheet shows: the figure of each source document, and every unit each
// quantity was recorded in. The second is the honest half - it is what could not be added into one
// number. Both are built column by column rather than through `textTable`, whose column order is
// the exceptions vocabulary's and would put `unit` before the document it belongs to.
const rollupTables = (rollup: RecordedRollup): readonly SheetTable[] => [
  {
    id: 'byDocument',
    title: `${rollup.requestedMetricName} by source document`,
    table: table([
      ['document', stringColumn(rollup.documents.map((item) => item.title))],
      ['total', stringColumn(rollup.documents.map((item) => figureCell(item.requested.total)))],
      ['unit', stringColumn(rollup.documents.map((item) => item.requested.unit ?? ''))],
      ['objects', stringColumn(rollup.documents.map((item) => String(item.objects)))],
      ['recording', stringColumn(rollup.documents.map((item) => String(item.requested.objects)))],
      ['recordingNone', stringColumn(rollup.documents.map((item) => String(item.requested.without)))],
      ['recordedZero', stringColumn(rollup.documents.map((item) => String(item.requested.zeros)))],
      ['outcome', stringColumn(rollup.documents.map((item) => item.outcome))],
    ]),
  },
  {
    id: 'byUnit',
    title: 'Every unit each quantity was recorded in',
    table: (() => {
      const rows = rollup.metrics.flatMap((metric) =>
        metric.byUnit.map((item) => ({ metric, item })),
      );
      return table([
        ['quantity', stringColumn(rows.map((row) => row.metric.metricName))],
        ['unit', stringColumn(rows.map((row) => row.item.unit))],
        ['total', stringColumn(rows.map((row) => figureCell(row.item.total)))],
        ['objects', stringColumn(rows.map((row) => String(row.item.objects)))],
        ['recordedZero', stringColumn(rows.map((row) => String(row.item.zeros)))],
        [
          'addedUp',
          stringColumn(
            rows.map((row) => (row.metric.byUnit.length === 1 ? 'yes' : 'no: recorded in more than one unit')),
          ),
        ],
      ]);
    })(),
  },
];

// The sheet for a model the demo did not generate. With a roll-up it is the roll-up; without one -
// a format carrying no parameter table - it is what the file holds and what the roll-up would need.
export const sourceSheet = (
  title: string,
  reading: ModelReading,
  rollup?: RecordedRollup | undefined,
  drilled?: number | undefined,
): PropertySheet => {
  if (rollup === undefined)
    return propertySheet(
      title,
      [fileGroup(reading), drillThroughGroup(), categoryGroup(reading)],
      noPropertiesBasis,
    );
  const document = drilled === undefined ? undefined : rollup.documents.find((item) => item.index === drilled);
  return propertySheet(
    document === undefined ? title : document.title,
    [
      ...(document === undefined ? [] : [drilledDocumentGroup(document, rollup.requestedMetricName)]),
      rollupGroup(rollup),
      documentsGroup(rollup),
      otherMetricsGroup(rollup),
      fileGroup(reading),
      categoryGroup(reading),
    ],
    sourceBasis,
    rollupTables(rollup),
  );
};

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
  if (subject.kind === 'source')
    return sourceSheet(subject.title, subject.reading, subject.rollup, drilledDocument());
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
