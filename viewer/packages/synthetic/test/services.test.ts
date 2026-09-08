// The services network: determinism, topology that closes, and the gaps that must survive.

import { describe, expect, it } from 'vitest';
import { columnOf, coverageOf, noMesh, stringAt, type Table } from '@bim-open-toolkit/model';
import { defaultServicesOptions, generateServices } from '../src/services.js';

// The strings of one column, or an empty list when the column is not a string column.
const strings = (source: Table, name: string): readonly string[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'string' ? [] : [...column.values];
};

// The numbers of one f64 column.
const numbers = (source: Table, name: string): readonly number[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'f64' ? [] : [...column.values];
};

const services = generateServices(defaultServicesOptions);

describe('generateServices', () => {
  it('is a function of its options alone', () => {
    const again = generateServices(defaultServicesOptions);
    expect(strings(again.segments, 'topologyStatus')).toEqual(strings(services.segments, 'topologyStatus'));
    expect(numbers(again.segments, 'diameter')).toEqual(numbers(services.segments, 'diameter'));
    expect(again.model.objects.map((item) => item.ref.objectId)).toEqual(
      services.model.objects.map((item) => item.ref.objectId),
    );
  });

  it('gives a different network for a different seed', () => {
    const other = generateServices({ ...defaultServicesOptions, seed: 2 });
    expect(numbers(other.segments, 'diameter')).not.toEqual(numbers(services.segments, 'diameter'));
  });

  it('counts nodes and segments from the options', () => {
    const { storeys, branchesPerStorey, fixturesPerBranch } = defaultServicesOptions;
    const branchNodes = storeys * branchesPerStorey * fixturesPerBranch;
    expect(services.nodes.rowCount).toBe(1 + storeys + branchNodes);
    expect(services.segments.rowCount).toBe(storeys + branchNodes);
    expect(services.valves.rowCount).toBe(storeys * branchesPerStorey + 1);
  });

  it('names a node that exists at both ends of every segment', () => {
    const known = new Set(strings(services.nodes, 'nodeId'));
    for (const name of ['fromNodeId', 'toNodeId']) {
      for (const nodeId of strings(services.segments, name)) expect(known.has(nodeId)).toBe(true);
    }
  });

  it('leaves the riser accepted so a trace has something to walk', () => {
    const ids = strings(services.segments, 'objectId');
    const status = strings(services.segments, 'topologyStatus');
    ids.forEach((id, row) => {
      if (id.startsWith('pipe-riser-')) expect(status[row]).toBe('accepted');
    });
  });

  it('leaves some branch connections unverified', () => {
    const status = strings(services.segments, 'topologyStatus');
    expect(status.filter((value) => value === 'unverified').length).toBeGreaterThan(0);
    expect(status.every((value) => value === 'accepted' || value === 'unverified')).toBe(true);
  });

  it('reports an unknown diameter as NaN beside a state column, never as zero', () => {
    const values = numbers(services.segments, 'diameter');
    const states = strings(services.segments, 'diameterState');
    values.forEach((value, row) => {
      if (states[row] === 'known') expect(value).toBeGreaterThan(0);
      else expect(Number.isNaN(value)).toBe(true);
    });
    expect(states.filter((state) => state !== 'known').length).toBeGreaterThan(0);
  });

  it('has a coverage that agrees with the state columns', () => {
    const states = strings(services.segments, 'diameterState');
    expect(services.diameterCoverage.total).toBe(states.length);
    expect(services.diameterCoverage.known).toBe(states.filter((state) => state === 'known').length);
    expect(services.diameterCoverage.conflicting).toBe(states.filter((state) => state === 'conflicting').length);
    expect(services.connectionCoverage.total).toBe(services.segments.rowCount);
  });

  it('suggests a trace whose start node and closed valve both exist', () => {
    expect(strings(services.nodes, 'nodeId')).toContain(services.startNodeId);
    const valveIds = strings(services.valves, 'objectId');
    for (const valveId of services.closedValveIds) expect(valveIds).toContain(valveId);
  });

  it('places every object it draws and draws every object it places', () => {
    expect(services.geometry.instances.count).toBe(services.model.objects.length);
    for (let row = 0; row < services.geometry.instances.count; row++) {
      expect(services.geometry.instances.objectIndex[row]).toBe(row);
      expect(services.geometry.instances.meshIndex[row]).not.toBe(noMesh);
    }
    const placed = services.meshGroups.reduce((total, group) => total + group.instanceCount, 0);
    expect(placed).toBe(services.geometry.instances.count);
  });

  it('records two facts per segment whose coverage matches the tables', () => {
    expect(services.facts.length).toBe(services.segments.rowCount * 2);
    const connections = services.facts.filter((item) => item.name === 'connection');
    expect(coverageOf(connections.map((item) => item.observation))).toEqual(services.connectionCoverage);
  });

  it('leaves a valve nobody located with an empty node id rather than a guessed one', () => {
    const located = columnOf(services.valves, 'nodeIdKnown');
    const nodeIds = columnOf(services.valves, 'nodeId');
    if (located === undefined || located.type !== 'bool' || nodeIds === undefined || nodeIds.type !== 'string') {
      throw new Error('the valve table is missing its location columns');
    }
    for (let row = 0; row < services.valves.rowCount; row++) {
      if (located.values[row] === 0) expect(stringAt(nodeIds, row)).toBe('');
      else expect(stringAt(nodeIds, row)).not.toBe('');
    }
  });

  it('closes every gap at gapScale zero except the ones that are policy', () => {
    const complete = generateServices({ ...defaultServicesOptions, gapScale: 0, unverifiedRate: 0 });
    expect(strings(complete.segments, 'diameterState').every((state) => state === 'known')).toBe(true);
    expect(strings(complete.segments, 'topologyStatus').every((state) => state === 'accepted')).toBe(true);
  });

  it('refuses options it cannot build', () => {
    expect(() => generateServices({ ...defaultServicesOptions, storeys: 0 })).toThrow(/storeys/);
    expect(() => generateServices({ ...defaultServicesOptions, branchesPerStorey: 5 })).toThrow(/branchesPerStorey/);
    expect(() => generateServices({ ...defaultServicesOptions, unverifiedRate: 2 })).toThrow(/unverifiedRate/);
  });
});
