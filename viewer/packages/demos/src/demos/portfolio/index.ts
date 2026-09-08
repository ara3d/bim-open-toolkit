// Demo 21, Workflows: which building in the estate is the outlier, and can I drill in?
//
// The estate opens with the portfolio drill-through already applied: the buildings are coloured by
// whether a figure could be attributed to them, the two sets the workflow names are defined, and
// the reader is looking at the buildings with no resolved figure. Clicking a card drills into one
// building; clicking it again comes back out.

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
import type { Demo, GalleryViewer } from '../../gallery/contracts.js';
import { applyWorkflowResult, type Applied } from '../_workflows/apply-result.js';
import { cityFixture, portfolioIndex } from './city.js';
import { portfolioSheet } from './inspector.js';
import { portfolioPanels } from './panels.js';
import { drilledBuildingId, rollupsOf } from './readings.js';

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
// isolated or selected.
export const resetPortfolio = (session: Session): void => {
  session.dispatch('overlays.clear', { layerId: portfolioLayerId });
  session.dispatch('appearance.clear', {});
  session.dispatch('sets.clear', {});
};

// True once the workflow's colouring and its two sets are in the session.
export const portfolioReady = (session: Session): boolean =>
  session.read(appearanceSlice).rules.some((rule) => rule.id.startsWith('portfolio/')) &&
  session.read(setsSlice).sets.some((set) => set.id === 'portfolio/unresolved');

// The counts the README quotes and the browser smoke reads back.
export const portfolioReport = (session: Session): DemoReport => {
  const index = portfolioIndex();
  const result = index.result;
  if (!result.ok) return { ok: false, diagnostics: result.diagnostics.length };
  const drilled = drilledBuildingId(index, session.read(setsSlice).isolated);
  return {
    ok: true,
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

const start = (viewer: GalleryViewer): Promise<Result<Disposable>> => {
  const applied = applyPortfolio(viewer);
  if (!applied.ok) return Promise.resolve(failure(applied.diagnostics));
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
  fixtures: [cityFixture],
  panels: portfolioPanels(portfolioIndex()),
  inspector: portfolioSheet(portfolioIndex()),
  start,
  ready: portfolioReady,
  report: portfolioReport,
  source: 'viewer/packages/demos/src/demos/portfolio',
  verify: 'npx vitest run --root packages/demos test/demos/portfolio',
};
