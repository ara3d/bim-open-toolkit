// The placeholder demo without a browser: what it derives from the fixture, and what it says about
// itself through the session its feature owns.

import { describe, expect, it } from 'vitest';
import { objectKey } from '@bim-open-toolkit/model';
import { createSession, featureHost } from '@bim-open-toolkit/viewer';
import { defaultBuildingOptions, generateBuilding } from '@bim-open-toolkit/synthetic';
import {
  demo,
  enclosureKeys,
  originOf,
  placeholderFeature,
  unratedDoorKeys,
} from '../../src/demos/_shared/placeholder.js';

const building = generateBuilding(defaultBuildingOptions);

// A session with the placeholder's feature installed, which is what the demo page gives the demo.
const installed = () => {
  const started = createSession();
  if (!started.ok) throw new Error(started.diagnostics.map((one) => one.message).join('; '));
  const host = featureHost(started.value);
  const done = host.install([placeholderFeature]);
  if (!done.ok) throw new Error(done.diagnostics.map((one) => one.message).join('; '));
  return started.value;
};

describe('the placeholder demo', () => {
  it('names the doors whose fire rating is missing or disputed', () => {
    const unrated = unratedDoorKeys(building);
    expect(unrated.length).toBeGreaterThan(0);
    expect(unrated.length).toBeLessThan(building.doorCoverage.fireRating.total);
    expect(new Set(unrated).size).toBe(unrated.length);
  });

  it('names the walls a door is set into, and nothing else', () => {
    const walls = new Set(enclosureKeys(building.model));
    expect(walls.size).toBeGreaterThan(0);
    for (const record of building.model.objects)
      expect(walls.has(objectKey(record.ref))).toBe(record.category === 'Wall');
  });

  it('takes an object position from the translation of its placement', () => {
    const record = building.model.objects[0];
    expect(record).toBeDefined();
    if (record === undefined) return;
    expect(originOf(record)).toEqual([record.transform[12], record.transform[13], record.transform[14]]);
  });

  it('offers one synthetic fixture and says so', () => {
    expect(demo.fixtures).toHaveLength(1);
    expect(demo.fixtures[0]?.basis).toBe('synthetic');
  });

  it('is not ready before it has drawn, and reports what it drew after', () => {
    const session = installed();
    expect(demo.ready(session)).toBe(false);
    expect(demo.report(session)['unratedDoors']).toBe(0);

    const unrated = unratedDoorKeys(building);
    session.write(placeholderFeature.slice, {
      drawn: true,
      hideWalls: true,
      doors: building.doorCoverage.fireRating.total,
      unratedDoors: unrated.length,
      taggedDoor: unrated[0] ?? '',
    });
    expect(demo.ready(session)).toBe(true);
    expect(demo.report(session)['unratedDoors']).toBe(unrated.length);
    expect(demo.report(session)['taggedDoor']).toBe(unrated[0]);
  });

  it('changes what is shown through its command, not through the renderer', () => {
    const session = installed();
    expect(session.dispatch('placeholder/hide-walls', { hidden: false }).ok).toBe(true);
    expect(demo.report(session)['hideWalls']).toBe(false);
    expect(session.dispatch('placeholder/hide-walls', { hidden: 'no' }).ok).toBe(false);
  });
});
