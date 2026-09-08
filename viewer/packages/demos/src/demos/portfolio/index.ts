// Demo 21, Workflows: which building in the estate is the outlier, and can I drill in?
//
// The estate opens with the portfolio drill-through already applied: the buildings are coloured by
// whether a figure could be attributed to them, the two sets the workflow names are defined, and
// the reader is looking at the buildings with no resolved figure. Clicking a card drills into one
// building; clicking it again comes back out.
//
// Snowdon Towers is listed second. It is one real building, and the drill-through's three inputs -
// buildings, the documents that report figures about them, and the figures - are none of them
// readable out of it, so opening it runs no workflow and shows what the file holds instead. The
// reasons are in `snowdon.ts`. Nothing about the estate is claimed of it and nothing about it is
// claimed of the estate.

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
  success,
  type AnyFeature,
  type Disposable,
  type Result,
  type Session,
} from '@bim-open-toolkit/model';
import { resultRows } from '@bim-open-toolkit/workflows';
import type { DemoReport } from '../../feature-demos/_shared/protocol.js';
import type { Demo, DemoFixture, GalleryViewer } from '../../gallery/contracts.js';
import { applyWorkflowResult, type Applied } from '../_workflows/apply-result.js';
import { cityFixture, portfolioIndex } from './city.js';
import { portfolioSheet } from './inspector.js';
import { portfolioPanels } from './panels.js';
import { drilledBuildingId, rollupsOf } from './readings.js';
import { currentSubject, lookAt, resetLook, snowdonFixture, subjectOf, type Subject } from './snowdon.js';

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

// Takes back everything the demo added: the labels, the colouring, and the sets it defined,
// isolated or selected, and the subject it was looking at.
export const resetPortfolio = (session: Session): void => {
  session.dispatch('overlays.clear', { layerId: portfolioLayerId });
  session.dispatch('appearance.clear', {});
  session.dispatch('sets.clear', {});
  resetLook();
};

// True once the demo shows what it promises. On the estate that is the workflow's colouring and its
// two sets; on a model read from a file it is the reading of that model, which is all the demo ever
// promised of it and is in hand before anything is dispatched.
export const portfolioReady = (session: Session): boolean => {
  const subject = currentSubject();
  if (subject.kind === 'source') return subject.reading.objects > 0;
  return (
    session.read(appearanceSlice).rules.some((rule) => rule.id.startsWith('portfolio/')) &&
    session.read(setsSlice).sets.some((set) => set.id === 'portfolio/unresolved')
  );
};

// What the demo says about a model it did not generate: the counts it read, and the three things
// the drill-through needs that the file does not give it. No figure is reported as zero, because
// zero would be a count of figures rather than the absence of the table that would carry them.
const sourceReport = (subject: Extract<Subject, { kind: 'source' }>): DemoReport => ({
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
  workflow: 'not run: the file reports no figure and attributes none to a building',
});

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
