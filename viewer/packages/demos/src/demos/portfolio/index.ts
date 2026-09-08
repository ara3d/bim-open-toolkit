// Demo 21, Workflows: which building in the estate is the outlier, and can I drill in?
//
// The estate opens with the portfolio drill-through already applied: the buildings are coloured by
// whether a figure could be attributed to them, the two sets the workflow names are defined, and
// the reader is looking at the buildings with no resolved figure. Clicking a card drills into one
// building; clicking it again comes back out.
//
// Snowdon Towers is listed second, and it now runs a roll-up of its own over figures read out of
// the file: floor area in the unit the exporter recorded it in, added up per source document, with
// a panel to drill into one document and the objects recording no area coloured as recording none.
// It is a different question from the estate's - it is one building, so there is no outlier among
// buildings to find, and every one of its objects names exactly one document, so there is nothing
// to disambiguate. `recorded.ts` states that difference and why the estate stays the default.
// Nothing about the estate is claimed of it and nothing about it is claimed of the estate.

import {
  appearanceFeature,
  appearanceSlice,
  editsFeature,
  navigationAidsFeature,
  overlaysFeature,
  setsFeature,
  setsSlice,
} from '@bim-open-toolkit/features';
import {
  disposable,
  failure,
  resultOf,
  success,
  type AnyFeature,
  type Diagnostic,
  type Disposable,
  type Result,
  type Session,
} from '@bim-open-toolkit/model';
import { outcomeRules, resultRows } from '@bim-open-toolkit/workflows';
import type { DemoReport } from '../../feature-demos/_shared/protocol.js';
import type { Demo, DemoFixture, GalleryViewer } from '../../gallery/contracts.js';
import { applyWorkflowResult, type Applied } from '../_workflows/apply-result.js';
import { cityFixture, portfolioIndex } from './city.js';
import { portfolioSheet } from './inspector.js';
import { portfolioPanels } from './panels.js';
import { drilledBuildingId, rollupsOf } from './readings.js';
import { metricText, notTotalled, type RecordedRollup } from './recorded.js';
import {
  currentSubject,
  drilledDocument,
  lookAt,
  resetLook,
  snowdonFixture,
  subjectOf,
  type Subject,
} from './snowdon.js';

// The features the demo installs: sets for the two the workflow names and for the drill-in
// isolation, appearance for its colouring, overlays for its per-building labels, navigation for the
// saved view and for framing one building.
export const portfolioFeatures: readonly AnyFeature[] = [
  editsFeature,
  setsFeature,
  appearanceFeature,
  overlaysFeature,
  navigationAidsFeature,
];

// The overlay layer the workflow's per-building labels are drawn into.
export const portfolioLayerId = 'portfolio';

// Puts the workflow result into a session: its sets, its colouring, its labels, its saved view, and
// the selection it ends at. This is everything `start` does that a session alone can do, so a test
// drives the same code the page does.
export const applyPortfolio = (session: Session): Result<Applied> => {
  const index = portfolioIndex();
  return index.result.ok
    ? applyWorkflowResult(session, index.result.value, { layerId: portfolioLayerId })
    : failure(index.result.diagnostics);
};

// Puts a roll-up read out of a file into a session: the two sets, named exactly as the workflow
// names its own so everything downstream reads one vocabulary, and the outcome colouring.
//
// The objects are coloured by whether the file records the metric against them - green where it
// does, amber where it does not - so the picture answers "how much of this building has a recorded
// floor area" before any number is read. `outcomeRules` is the workflows package's own colouring,
// used unchanged, because a second palette for the same five states would mean two things by one
// colour.
export const applyRecordedRollup = (session: Session, rollup: RecordedRollup): Result<Applied> => {
  const resolved = rollup.byOutcome.get('resolved') ?? [];
  const unresolved = [
    ...(rollup.byOutcome.get('missing') ?? []),
    ...(rollup.byOutcome.get('conflicting') ?? []),
    ...(rollup.byOutcome.get('excluded') ?? []),
  ];
  const rules = outcomeRules('portfolio', rollup.byOutcome);
  const diagnostics: Diagnostic[] = [];
  let ok = true;
  for (const set of [
    { id: 'portfolio/resolved', name: `Objects recording a ${rollup.requestedMetricName}`, members: resolved },
    { id: 'portfolio/unresolved', name: `Objects recording no ${rollup.requestedMetricName}`, members: unresolved },
  ]) {
    const done = session.dispatch('sets.define', set);
    diagnostics.push(...done.diagnostics);
    ok = done.ok && ok;
  }
  if (rules.length > 0) {
    const done = session.dispatch('appearance.addRules', { rules });
    diagnostics.push(...done.diagnostics);
    ok = done.ok && ok;
  }
  const applied: Applied = {
    setIds: ['portfolio/resolved', 'portfolio/unresolved'],
    ruleIds: rules.map((rule) => rule.id),
    overlayIds: [],
    viewId: '',
    selectedSetId: undefined,
  };
  return ok ? resultOf(applied, diagnostics) : failure(diagnostics);
};

// Takes back everything the demo added: the labels, the colouring, and the sets it defined,
// isolated or selected, and the subject it was looking at.
export const resetPortfolio = (session: Session): void => {
  session.dispatch('overlays.clear', { layerId: portfolioLayerId });
  session.dispatch('appearance.clear', {});
  session.dispatch('sets.clear', {});
  resetLook();
};

// True once the demo shows what it promises, which on both fixtures is the same two things: the
// outcome colouring and the set of what could not be resolved. A model the demo read from a file
// whose format carries no parameter table has no roll-up to apply, and then what it promises is the
// reading of the file itself, which is in hand before anything is dispatched.
export const portfolioReady = (session: Session): boolean => {
  const subject = currentSubject();
  if (subject.kind === 'source' && subject.rollup === undefined) return subject.reading.objects > 0;
  return (
    session.read(appearanceSlice).rules.some((rule) => rule.id.startsWith('portfolio/')) &&
    session.read(setsSlice).sets.some((set) => set.id === 'portfolio/unresolved')
  );
};

// What the demo says about a model it did not generate: the counts it read off the records, and the
// roll-up it read out of the parameter tables. Every figure carries the unit the file recorded it
// in and nothing is converted. `withoutFigure` is a count of objects carrying no row for the
// metric; it is never folded into the total as a zero, and `recordedZero` is the different thing -
// objects whose recorded value is zero.
const sourceReport = (subject: Extract<Subject, { kind: 'source' }>): DemoReport => {
  const counts: DemoReport = {
    ok: true,
    basis: 'source-backed',
    model: subject.title,
    origin: subject.reading.origin,
    objects: subject.reading.objects,
    named: subject.reading.named,
    categorised: subject.reading.categorised,
    identified: subject.reading.identified,
    drawn: subject.reading.drawn,
    categories: subject.reading.categories.length,
  };
  const rollup = subject.rollup;
  if (rollup === undefined)
    return { ...counts, rollup: 'not run: this file carries no parameter table and no document table' };
  const drilled = drilledDocument();
  return {
    ...counts,
    metric: rollup.requestedMetricName,
    unit: rollup.requested.unit ?? 'more than one unit recorded',
    total: metricText(rollup.requested),
    documents: rollup.documents.length,
    largest: rollup.documents[0]?.title ?? 'none',
    withFigure: rollup.requested.objects,
    withoutFigure: rollup.requested.without,
    recordedZero: rollup.requested.zeros,
    unattributedObjects: rollup.unattributed,
    parameterRows: rollup.propertyRows,
    droppedRows: rollup.droppedRows,
    notTotalled: notTotalled(rollup)
      .map((metric) => `${metric.metricName} in ${metric.byUnit.map((item) => item.unit).join(' and ')}`)
      .join('; '),
    drilledDocument:
      drilled === undefined ? 'none' : rollup.documents.find((item) => item.index === drilled)?.title ?? 'none',
  };
};

// The counts the README quotes and the browser smoke reads back.
export const portfolioReport = (session: Session): DemoReport => {
  const subject = currentSubject();
  if (subject.kind === 'source') return sourceReport(subject);
  const index = portfolioIndex();
  const result = index.result;
  if (!result.ok) return { ok: false, diagnostics: result.diagnostics.length };
  const drilled = drilledBuildingId(index, session.read(setsSlice).isolated);
  return {
    ok: true,
    basis: 'synthetic',
    metric: index.metricName,
    buildings: index.input.buildings.length,
    documents: index.documents.length,
    unmappedDocuments: index.documents.filter((item) => item.buildingIds.length === 0).length,
    ambiguousDocuments: index.documents.filter((item) => item.buildingIds.length > 1).length,
    resolvedFigures: resultRows(result.value, 'drillThrough').length,
    unresolvedFigures: result.value.exceptions.length,
    sitesWithRollup: rollupsOf(result.value).length,
    sites: new Set(index.input.buildings.map((item) => item.siteId)).size,
    drilled: drilled ?? 'none',
  };
};

// The demo's data, the estate first. Snowdon is opt-in, which is the gallery's own rule for it.
export const portfolioFixtures: readonly DemoFixture[] = [cityFixture, snowdonFixture];

// `mountDemo` opens the fixture before it calls this, so `opened` says which one the reader chose.
// It is the one place the contract hands a demo the models themselves; everything after it is given
// a session, so what was seen here is recorded for them to read.
const start = (viewer: GalleryViewer): Promise<Result<Disposable>> => {
  const subject = subjectOf(portfolioIndex().city.model.ref.id, viewer.opened());
  lookAt(subject);
  if (subject.kind === 'source') {
    const rollup = subject.rollup;
    if (rollup !== undefined) {
      const put = applyRecordedRollup(viewer, rollup);
      if (!put.ok) {
        resetLook();
        return Promise.resolve(failure(put.diagnostics));
      }
    }
    viewer.fit();
    return Promise.resolve(success(disposable(() => resetPortfolio(viewer))));
  }
  const applied = applyPortfolio(viewer);
  if (!applied.ok) {
    resetLook();
    return Promise.resolve(failure(applied.diagnostics));
  }
  viewer.fit();
  return Promise.resolve(success(disposable(() => resetPortfolio(viewer))));
};

export const demo: Demo = {
  id: 'portfolio',
  chapter: 'workflows',
  title: 'Portfolio drill-through',
  question: 'Which building in the estate is the outlier, and can I drill in?',
  briefIds: ['section 6 row 10', 'F26'],
  features: portfolioFeatures,
  fixtures: portfolioFixtures,
  panels: portfolioPanels(portfolioIndex()),
  inspector: portfolioSheet(portfolioIndex()),
  start,
  ready: portfolioReady,
  report: portfolioReport,
  source: 'viewer/packages/demos/src/demos/portfolio',
  verify: 'npx vitest run --root packages/demos test/demos/portfolio',
};
