import { describe, expect, it } from 'vitest';
import { appearanceSlice, setsSlice } from '@bim-open-toolkit/features';
import { resultRows } from '@bim-open-toolkit/workflows';
import {
  applyPortfolio,
  demo,
  portfolioFeatures,
  portfolioReady,
  portfolioReport,
  resetPortfolio,
} from '../../../src/demos/portfolio/index.js';
import { buildingKey, portfolioIndex } from '../../../src/demos/portfolio/city.js';
import { portfolioSheet } from '../../../src/demos/portfolio/inspector.js';
import { cardOf, drill, portfolioPanels } from '../../../src/demos/portfolio/panels.js';
import { drilledBuildingId, rollupsOf } from '../../../src/demos/portfolio/readings.js';
import { commandNames, refusedCalls, sessionForFeatures } from '../_d4-support/fake-session.js';
import { probePanel, semanticLabels } from '../_d4-support/panel-probe.js';

const index = portfolioIndex();

const started = () => {
  const session = sessionForFeatures(portfolioFeatures);
  const applied = applyPortfolio(session);
  return { session, applied };
};

describe('the estate the portfolio demo opens', () => {
  it('states the gaps the generator documents rather than filling them in', () => {
    expect(index.result.ok).toBe(true);
    if (!index.result.ok) return;
    expect(index.documents.some((item) => item.buildingIds.length === 0)).toBe(true);
    expect(index.documents.some((item) => item.buildingIds.length > 1)).toBe(true);
    expect(index.result.value.exceptions.length).toBeGreaterThan(0);
  });

  it('gives no rollup to a site whose every figure was disputed or absent', () => {
    if (!index.result.ok) return;
    const sites = new Set(index.input.buildings.map((building) => building.siteId));
    expect(rollupsOf(index.result.value).length).toBeLessThan(sites.size);
  });
});

describe('starting the portfolio demo', () => {
  it('applies the workflow result through the features every one of its commands is accepted', () => {
    const { session, applied } = started();
    expect(refusedCalls(session)).toEqual([]);
    expect(applied.ok).toBe(true);
    expect(commandNames(session)).toContain('sets.define');
    expect(commandNames(session)).toContain('appearance.addRules');
    expect(commandNames(session)).toContain('navigation.saveView');
    expect(portfolioReady(session)).toBe(true);
  });

  it('leaves the reader looking at the buildings with no resolved figure', () => {
    const { session } = started();
    const state = session.read(setsSlice);
    const unresolved = state.sets.find((set) => set.id === 'portfolio/unresolved');
    expect(unresolved).toBeDefined();
    expect(state.selection).toEqual(unresolved?.members ?? []);
  });

  it('takes back its colouring and its sets when it is reset', () => {
    const { session } = started();
    resetPortfolio(session);
    expect(session.read(appearanceSlice).rules).toEqual([]);
    expect(session.read(setsSlice).sets).toEqual([]);
    expect(portfolioReady(session)).toBe(false);
  });

  it('is not ready before it has started', () => {
    expect(portfolioReady(sessionForFeatures(portfolioFeatures))).toBe(false);
  });
});

describe('the portfolio sheet', () => {
  it('shows a document nobody has mapped to a building as unmapped, not as absent', () => {
    const { session } = started();
    const sheet = portfolioSheet(index)(session);
    const documents = sheet.groups.find((group) => group.id === 'documents');
    expect(documents).toBeDefined();
    expect(documents?.rows.length).toBe(index.documents.length);
    const unmapped = index.documents.filter((item) => item.buildingIds.length === 0);
    expect(unmapped.length).toBeGreaterThan(0);
    for (const document of unmapped) {
      const row = documents?.rows.find((item) => item.key === document.documentId);
      expect(row?.value.state).toBe('missing');
      expect(row?.label).toBe(document.name);
    }
  });

  it('shows a document that names two buildings as a disagreement, never picking one', () => {
    const { session } = started();
    const documents = portfolioSheet(index)(session).groups.find((group) => group.id === 'documents');
    const ambiguous = index.documents.filter((item) => item.buildingIds.length > 1);
    expect(ambiguous.length).toBeGreaterThan(0);
    for (const document of ambiguous) {
      const row = documents?.rows.find((item) => item.key === document.documentId);
      expect(row?.value.state).toBe('conflicting');
      for (const buildingId of document.buildingIds) expect(row?.value.text).toContain(buildingId);
    }
  });

  it('carries the exceptions table and the two result tables', () => {
    const { session } = started();
    const sheet = portfolioSheet(index)(session);
    expect((sheet.tables ?? []).map((item) => item.id)).toEqual([
      'drillThrough',
      'portfolioRollup',
      'exceptions',
    ]);
    if (!index.result.ok) return;
    const exceptions = (sheet.tables ?? []).find((item) => item.id === 'exceptions');
    expect(exceptions?.table.rowCount).toBe(index.result.value.exceptions.length);
    const drillThrough = (sheet.tables ?? []).find((item) => item.id === 'drillThrough');
    expect(drillThrough?.table.rowCount).toBe(resultRows(index.result.value, 'drillThrough').length);
  });

  it('narrows to one building once the reader has drilled in, and says when nobody surveyed it', () => {
    const { session } = started();
    const unsurveyed = index.input.buildings.find(
      (building) => index.registration.get(building.buildingId) !== 'geographic',
    );
    expect(unsurveyed).toBeDefined();
    if (unsurveyed === undefined) return;
    drill(index, session, unsurveyed.buildingId);
    const sheet = portfolioSheet(index)(session);
    expect(sheet.title).toBe(unsurveyed.name);
    const building = sheet.groups.find((group) => group.id === 'building');
    expect(building?.rows.find((row) => row.key === 'registration')?.value.state).toBe('missing');
  });
});

describe('the building cards', () => {
  it('draws one card per building, each over the top of its own mass', () => {
    const { session } = started();
    const panels = portfolioPanels(index);
    expect(panels).toHaveLength(index.input.buildings.length);
    for (const panel of panels) {
      const probe = probePanel(panel, session);
      expect(probe).toBeDefined();
      expect(probe?.point()).toBeDefined();
      probe?.stop();
    }
  });

  it('says what it knows and what it does not, through the semantics the DOM mirror reads', () => {
    const { session } = started();
    const first = portfolioPanels(index)[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    const probe = probePanel(first, session);
    expect(semanticLabels(probe?.semantics() ?? []).length).toBeGreaterThan(0);
    probe?.stop();
  });

  it('reports no resolved figure rather than a zero when nothing could be attributed', () => {
    const { session } = started();
    if (!index.result.ok) return;
    const unresolved = session.read(setsSlice).sets.find((set) => set.id === 'portfolio/unresolved');
    const buildingId = index.input.buildings.find(
      (building) => unresolved?.members.includes(buildingKey(index, building.buildingId)) === true,
    )?.buildingId;
    expect(buildingId).toBeDefined();
    if (buildingId === undefined) return;
    expect(cardOf(index, session, buildingId).figure).toBe('No resolved figure');
  });

  it('drills into one building on a keyboard activation, and back out on the next one', () => {
    const { session } = started();
    const buildingId = index.input.buildings[0]?.buildingId;
    expect(buildingId).toBeDefined();
    if (buildingId === undefined) return;
    const panel = portfolioPanels(index).find((item) => item.id === `portfolio/card/${buildingId}`);
    expect(panel).toBeDefined();
    if (panel === undefined) return;
    const probe = probePanel(panel, session);
    expect(probe?.activate()).toBe(true);
    expect(drilledBuildingId(index, session.read(setsSlice).isolated)).toBe(buildingId);
    expect(commandNames(session)).toContain('navigation.frame');
    probe?.sync();
    expect(probe?.activate()).toBe(true);
    expect(session.read(setsSlice).isolated).toBeNull();
    probe?.stop();
  });

  it('hides the cards of the other buildings while one is drilled into', () => {
    const { session } = started();
    const buildingId = index.input.buildings[0]?.buildingId;
    const otherId = index.input.buildings[1]?.buildingId;
    if (buildingId === undefined || otherId === undefined) return;
    drill(index, session, buildingId);
    const other = portfolioPanels(index).find((item) => item.id === `portfolio/card/${otherId}`);
    const probe = other === undefined ? undefined : probePanel(other, session);
    expect(probe?.point()).toBeUndefined();
    probe?.stop();
  });
});

describe('the portfolio demo registration', () => {
  it('names itself, its chapter and the command that verifies it', () => {
    expect(demo.id).toBe('portfolio');
    expect(demo.chapter).toBe('workflows');
    expect(demo.fixtures[0]?.basis).toBe('synthetic');
    expect(demo.verify).toContain('test/demos/portfolio');
  });

  it('reports counts a reader can check against the estate', () => {
    const { session } = started();
    const report = portfolioReport(session);
    expect(report['buildings']).toBe(index.input.buildings.length);
    expect(report['documents']).toBe(index.documents.length);
    expect(report['unmappedDocuments']).toBe(1);
    expect(report['drilled']).toBe('none');
    if (!index.result.ok) return;
    expect(report['unresolvedFigures']).toBe(index.result.value.exceptions.length);
  });
});
