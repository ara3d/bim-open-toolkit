/**
 * Question: when a few instances change colour, how much work does the alpha
 * renderer's mirror actually do?
 *
 * `BatchObject.sync` compares one version per group and, when it differs,
 * rewrites every instance of that group's range. With the packed small-mesh path
 * on it rewrites every vertex of every instance in the range instead. So the work
 * is not proportional to what changed; it is proportional to the ranges that
 * contain what changed, plus a walk over every range in the model.
 *
 * CPU-side only: no WebGL context, so no upload or draw cost is included. The
 * scene here is 50,000 instances rather than the reference model's 456,598,
 * because the packed path only engages below a vertex budget and because
 * building a mirror of the whole reference model costs a third of a second.
 *
 * Each mirror gets its own scene. Two mirrors over one scene would see each
 * other's changes, and the case that is supposed to sync nothing would absorb
 * whatever the other case had just changed.
 *
 * Every table below reports medians. Every assertion compares the fastest of the
 * repetitions instead, because this machine is shared with other work:
 * interference can only ever make a run slower, so the minimum is the estimate
 * that survives a busy machine.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { SceneObject, ViewerScene } from '@ara3d/viewer-core';
import { measureAll, prepare, reportSamples, sampleFor, type Prepared, type Sample } from '../../src/perf/measure.js';
import {
  createSyntheticScene, scaledShape, selectRows, sortRows, type SyntheticScene,
} from '../../src/perf/scene.js';

const INSTANCES = 50_000;
const SHAPE_SEED = 41;
const fractions: readonly number[] = [0.01, 0.1, 1];

/** The same row selections apply to every fixture, because all share one shape. */
const changedRows = new Map<number, Int32Array>();
const rowsFor = (fraction: number): Int32Array => {
  const known = changedRows.get(fraction);
  if (known) return known;
  throw new Error(`no rows for ${fraction}`);
};

const percent = (fraction: number): string => `${(fraction * 100).toFixed(0)}%`;

/** A scene, a mirror of it, and a name for the tables. */
interface Fixture {
  readonly name: string;
  readonly scene: SyntheticScene;
  readonly mirror: SceneObject;
}

const fixtures: Fixture[] = [];

/** A fixture whose mirror is already built and synced, so a measured sync is an update. */
function makeFixture(name: string, packedGeometry: boolean): Fixture {
  const scene = createSyntheticScene(scaledShape(INSTANCES, SHAPE_SEED));
  const model = new ViewerScene();
  for (const group of scene.groups) model.addGroup(group);
  const mirror = new SceneObject(model, 1, packedGeometry);
  mirror.sync();
  const fixture = { name, scene, mirror };
  fixtures.push(fixture);
  return fixture;
}

afterAll(() => { for (const fixture of fixtures) fixture.mirror.dispose(); });

let tint = 0;
const nextTint = (): number => {
  tint = (tint + 0.017) % 0.5;
  return tint;
};

/** Recolours `rows` through the alpha's per-instance call, which bumps group versions. */
function recolour(fixture: Fixture, rows: Int32Array): void {
  const value = nextTint();
  for (const row of rows) {
    const group = fixture.scene.groups[fixture.scene.groupOf[row] ?? 0];
    if (!group) throw new Error('missing group');
    group.setColor(fixture.scene.indexInGroup[row] ?? 0, value, 0.4, 0.8, 1);
  }
}

/** Instances the mirror rewrites when `rows` change: every instance of every touched group. */
function amplifiedInstances(scene: SyntheticScene, rows: Int32Array): number {
  const touched = new Set<number>();
  for (const row of rows) touched.add(scene.groupOf[row] ?? -1);
  let total = 0;
  for (const g of touched) total += scene.groups[g]?.instanceCount ?? 0;
  return total;
}

const single = Int32Array.of(17);

const idleLabel = (name: string): string => `${name}: sync with nothing changed`;
const oneLabel = (name: string): string => `${name}: sync after one instance changed`;
const fractionLabel = (name: string, fraction: number): string =>
  `${name}: sync after ${percent(fraction)} changed (${rowsFor(fraction).length} rows)`;

const syncCases = (fixture: Fixture): Prepared[] => [
  prepare({
    label: idleLabel(fixture.name),
    setup: () => fixture.mirror,
    body: (mirror) => (mirror.sync() ? 1 : 0),
  }),
  prepare({
    label: oneLabel(fixture.name),
    setup: () => { recolour(fixture, single); return fixture.mirror; },
    body: (mirror) => (mirror.sync() ? 1 : 0),
  }),
  ...fractions.map((fraction) => prepare({
    label: fractionLabel(fixture.name, fraction),
    setup: () => { recolour(fixture, rowsFor(fraction)); return fixture.mirror; },
    body: (mirror) => (mirror.sync() ? 1 : 0),
  })),
];

describe('what the renderer does when a few instances change', () => {
  const batched = makeFixture('batched', false);
  for (const fraction of fractions)
    changedRows.set(fraction, sortRows(selectRows(batched.scene.rowCount, fraction, 31)));

  it('walks every group whatever changed, so one changed instance is most of the cost of five hundred', () => {
    const samples = measureAll(syncCases(batched), { repetitions: 9, warmups: 2 });
    reportSamples(
      `syncing ${batched.scene.rowCount} instances in ${batched.scene.groups.length} groups, packed geometry off`,
      samples);

    const idle = sampleFor(samples, idleLabel('batched'));
    const one = sampleFor(samples, oneLabel('batched'));
    const onePercent = sampleFor(samples, fractionLabel('batched', 0.01));
    const all = sampleFor(samples, fractionLabel('batched', 1));

    // A sync with no change at all returns immediately: the scene revision is
    // unchanged, so no group is examined.
    expect(idle.result).toBe(0);
    expect(one.result).toBe(1);
    expect(idle.minMs).toBeLessThan(one.minMs / 10);
    // But any change at all costs a walk over every group. Changing one instance
    // is therefore within a small factor of changing five hundred, not a five
    // hundredth of it.
    expect(one.minMs).toBeGreaterThan(onePercent.minMs / 5);
    // Changing everything is the ceiling.
    expect(all.minMs).toBeGreaterThan(onePercent.minMs);
  });

  it('costs several times more with the packed small-mesh path, which rewrites vertices not instances', () => {
    const packed = makeFixture('packed', true);
    // Interleaved, which is fair because the two fixtures have separate scenes.
    const samples = measureAll(
      [...syncCases(packed), ...syncCases(batched)], { repetitions: 9, warmups: 2 });
    reportSamples(`syncing ${INSTANCES} instances, packed geometry on against off`, samples);

    const pair = (label: (name: string) => string): readonly [Sample, Sample] =>
      [sampleFor(samples, label('packed')), sampleFor(samples, label('batched'))];

    const rows = [
      '| change | instances the mirror rewrites | packed on, median ms | packed off, median ms |',
      '| ------ | ----------------------------- | -------------------- | --------------------- |',
      `| one instance | ${amplifiedInstances(packed.scene, single)} | ${pair(oneLabel)[0].medianMs.toFixed(2)} | ${pair(oneLabel)[1].medianMs.toFixed(2)} |`,
      ...fractions.map((fraction) => {
        const [on, off] = pair((name) => fractionLabel(name, fraction));
        return `| ${percent(fraction)} of instances | ${amplifiedInstances(packed.scene, rowsFor(fraction))} | ${on.medianMs.toFixed(2)} | ${off.medianMs.toFixed(2)} |`;
      }),
    ];
    console.log(`\nwhat a colour change costs the mirror\n${rows.join('\n')}`);

    // Baking vertex colours costs several times writing instance colours once
    // enough instances are touched for the vertices to dominate the range walk.
    const [packedTenth, plainTenth] = pair((name) => fractionLabel(name, 0.1));
    const [packedAll, plainAll] = pair((name) => fractionLabel(name, 1));
    expect(packedTenth.minMs).toBeGreaterThan(plainTenth.minMs);
    expect(packedAll.minMs).toBeGreaterThan(plainAll.minMs * 2);
    // For a single instance the two are the same: four instances' vertices are
    // nothing next to the walk over every group, so no claim separates them.
    expect(pair(oneLabel)[0].result).toBe(1);
  });
});
