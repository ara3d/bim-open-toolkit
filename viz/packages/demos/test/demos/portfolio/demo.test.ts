import { afterEach, describe, expect, it } from 'vitest';
import { appearanceSlice, setsSlice } from '@bim-open-toolkit/features';
import { emptyObject, objectRef } from '@bim-open-toolkit/model';
import type { AnyHudPanel } from '@bim-open-toolkit/ui-gratify';
import { defaultBuildingOptions, generateBuilding } from '@bim-open-toolkit/synthetic';
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
import { portfolioSheet, sourceSheet } from '../../../src/demos/portfolio/inspector.js';
import { cardOf, drill, portfolioPanels } from '../../../src/demos/portfolio/panels.js';
import { drilledBuildingId, rollupsOf } from '../../../src/demos/portfolio/readings.js';
import {
  categoryCounts,
  lookAt,
  readingOf,
  resetLook,
  snowdonFile,
  snowdonFixture,
  snowdonTitle,
  subjectOf,
} from '../../../src/demos/portfolio/snowdon.js';
import { openedModel } from '../../../src/gallery/model-source.js';
import { commandNames, refusedCalls, sessionForFeatures } from '../_d4-support/fake-session.js';
import { probePanel, semanticLabels } from '../_d4-support/panel-probe.js';

const index = portfolioIndex();

// A model the demo did not generate, standing in for one read from a file: everything the reading
// counts is a field of an object record, so a generated building exercises it without the private
// model file being anywhere near the test.
const foreignModel = () => {
  const built = generateBuilding(defaultBuildingOptions);
  return openedModel('snowdon', built.model, built.geometry);
};

const started = () => {
  const session = sessionForFeatures(portfolioFeatures);
  const applied = applyPortfolio(session);
  return { session, applied };
};

// The building cards, which is every panel except the roll-up panel the source fixture uses.
const cardPanels = (panels: readonly AnyHudPanel[]): readonly AnyHudPanel[] =>
  panels.filter((panel) => panel.id.startsWith('portfolio/card/'));

// The subject is held for the life of a mount, so every test starts on the estate.
afterEach(resetLook);

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
    // One card per building, plus the roll-up panel the source fixture uses, which hangs in a
    // corner rather than over a point and shows nothing at all while the estate is open.
    const panels = portfolioPanels(index);
    expect(panels).toHaveLength(index.input.buildings.length + 1);
    for (const panel of cardPanels(panels)) {
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

describe('reading a model the demo did not generate', () => {
  it('counts only fields the records carry, and every record lands in one category row', () => {
    const model = foreignModel();
    const reading = readingOf(model);
    expect(reading.objects).toBe(model.data.objects.length);
    expect(reading.named).toBe(model.data.objects.filter((record) => record.name !== undefined).length);
    expect(reading.categorised).toBe(model.data.objects.filter((record) => record.category !== undefined).length);
    expect(reading.drawn).toBe(model.data.objects.filter((record) => record.representation !== undefined).length);
    expect(reading.categories.reduce((total, item) => total + item.count, 0)).toBe(reading.objects);
  });

  it('counts records with no category under their own row rather than folding them into one', () => {
    const ref = index.city.model.ref;
    const walls = { ...emptyObject(objectRef(ref, 'a')), category: 'Walls' };
    const counts = categoryCounts([walls, emptyObject(objectRef(ref, 'b'))]);
    expect(counts.find((item) => item.name === 'No category')?.count).toBe(1);
    expect(counts.find((item) => item.name === 'Walls')?.count).toBe(1);
  });

  it('stays on the estate while only the estate is open, and leaves it for any other model', () => {
    const estateId = index.city.model.ref.id;
    const estate = openedModel(estateId, index.city.model, index.city.geometry);
    expect(subjectOf(estateId, [estate]).kind).toBe('estate');
    expect(subjectOf(estateId, []).kind).toBe('estate');
    const subject = subjectOf(estateId, [foreignModel()]);
    expect(subject.kind).toBe('source');
    if (subject.kind !== 'source') return;
    expect(subject.title).toBe(snowdonTitle);
  });
});

describe('the sheet for a model read from a file', () => {
  it('states what the file carries and why the drill-through is not run, never a zero figure', () => {
    const reading = readingOf(foreignModel());
    const sheet = sourceSheet(snowdonTitle, reading);
    expect(sheet.title).toBe(snowdonTitle);
    const needs = sheet.groups.find((group) => group.id === 'drill-through');
    expect(needs?.rows.length).toBeGreaterThan(0);
    for (const row of needs?.rows ?? []) {
      expect(row.value.state).toBe('missing');
      expect(row.value.missingReason ?? '').not.toBe('');
    }
    const file = sheet.groups.find((group) => group.id === 'file');
    expect(file?.rows.find((row) => row.key === 'objects')?.value.text).toBe(String(reading.objects));
  });

  it('replaces the estate sheet entirely, so no generated document is listed against it', () => {
    const { session } = started();
    lookAt(subjectOf(index.city.model.ref.id, [foreignModel()]));
    const sheet = portfolioSheet(index)(session);
    expect(sheet.groups.map((group) => group.id)).not.toContain('documents');
    expect(sheet.groups.map((group) => group.id)).not.toContain('estate');
    expect(sheet.tables).toBeUndefined();
  });

  it('takes the cards away, because no building of the estate is in the picture', () => {
    const { session } = started();
    lookAt(subjectOf(index.city.model.ref.id, [foreignModel()]));
    for (const panel of cardPanels(portfolioPanels(index))) {
      const probe = probePanel(panel, session);
      expect(probe?.point()).toBeUndefined();
      probe?.stop();
    }
  });

  it('reports what it read and says the roll-up was not run', () => {
    const { session } = started();
    const reading = readingOf(foreignModel());
    lookAt(subjectOf(index.city.model.ref.id, [foreignModel()]));
    const report = portfolioReport(session);
    expect(report['basis']).toBe('source-backed');
    expect(report['objects']).toBe(reading.objects);
    expect(report['rollup']).toContain('not run');
    expect(report['resolvedFigures']).toBeUndefined();
    expect(report['total']).toBeUndefined();
    expect(portfolioReady(session)).toBe(true);
  });
});

describe('the portfolio demo registration', () => {
  it('names itself, its chapter and the command that verifies it', () => {
    expect(demo.id).toBe('portfolio');
    expect(demo.chapter).toBe('workflows');
    expect(demo.fixtures[0]?.basis).toBe('synthetic');
    expect(demo.verify).toContain('test/demos/portfolio');
  });

  it('lists the real building second, source-backed, from the export that carries the BIM tables', () => {
    expect(demo.fixtures.map((fixture) => fixture.id)).toEqual(['synthetic-city', 'snowdon']);
    expect(snowdonFixture.basis).toBe('source-backed');
    expect(snowdonFile).toBe('snowdon-bim.bfast');
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
