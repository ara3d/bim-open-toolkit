import { describe, expect, it } from 'vitest';
import { defaultServicesOptions, generateServices, type Services } from '@bim-open-toolkit/synthetic';
import { rowOf } from '@bim-open-toolkit/model';
import {
  runValveIsolation,
  type IsolationNode,
  type IsolationSegment,
  type IsolationValve,
  type TopologyStatus,
  type ValveIsolationInput,
} from '../src/06-valve-isolation.js';
import { keyOf } from '../src/keys.js';
import { exceptionRows } from '../src/result.js';
import { valueOfResult } from './fixtures.js';

const textAt = (value: unknown): string => (typeof value === 'string' ? value : '');

const topologyStatusAt = (value: unknown): TopologyStatus => {
  const text = textAt(value);
  if (text === 'accepted' || text === 'unverified') return text;
  throw new Error(`unexpected topology status "${text}"`);
};

const nodesOf = (services: Services): readonly IsolationNode[] =>
  Array.from({ length: services.nodes.rowCount }, (_, row) => ({ nodeId: textAt(rowOf(services.nodes, row)['nodeId']) }));

// The network's plant-room node, read off the `nodes` table's own `kind` column rather than the
// generator's documented `startNodeId`. `startNodeId` names a leaf at the far end of one branch; with
// `fixturesPerBranch: 1` below, that leaf is also exactly where the generator's own `closedValveIds`
// closes a valve, so tracing from it stops the trace at its own starting node before it reaches
// anything. The plant room has no valve on it, so it is a start every branch is actually traced from.
const sourceNodeIdOf = (services: Services): string => {
  for (let row = 0; row < services.nodes.rowCount; row++) {
    const cells = rowOf(services.nodes, row);
    if (textAt(cells['kind']) === 'source') return textAt(cells['nodeId']);
  }
  throw new Error('the generated services network has no source node');
};

const segmentsOf = (services: Services): readonly IsolationSegment[] =>
  Array.from({ length: services.segments.rowCount }, (_, row) => {
    const cells = rowOf(services.segments, row);
    return {
      objectId: textAt(cells['objectId']),
      fromNodeId: textAt(cells['fromNodeId']),
      toNodeId: textAt(cells['toNodeId']),
      topologyStatus: topologyStatusAt(cells['topologyStatus']),
    };
  });

const valvesOf = (services: Services): readonly IsolationValve[] =>
  Array.from({ length: services.valves.rowCount }, (_, row) => {
    const cells = rowOf(services.valves, row);
    return { objectId: textAt(cells['objectId']), nodeId: textAt(cells['nodeId']) };
  });

const isolationInputOf = (services: Services): ValveIsolationInput => ({
  model: services.model.ref,
  startNodeId: sourceNodeIdOf(services),
  closedValveIds: services.closedValveIds,
  nodes: nodesOf(services),
  segments: segmentsOf(services),
  valves: valvesOf(services),
});

// With one fixture per branch, every branch segment leaves the plant-room source directly, and the
// riser (source to source) is always accepted topology, so a branch segment's source-side node is
// always reached whatever else is open or closed. The documented `closedValveIds` sits on a leaf that
// has nothing beyond it once `fixturesPerBranch` is 1, so it never removes anything from the trace
// either. That makes "touches the affected set" and "is unverified" the same condition for every
// branch segment, which is what lets the generator's own connection coverage stand in for the trace's
// exception count without re-deriving reachability by hand.
const services = generateServices({ ...defaultServicesOptions, fixturesPerBranch: 1 });
const input = isolationInputOf(services);
const result = valueOfResult('generated valve isolation', runValveIsolation(input));

describe('the valve isolation trace on a generated services network', () => {
  it('reports exactly the unverified connections the generator documents, as exceptions', () => {
    expect(services.connectionCoverage.missing).toBeGreaterThan(0);
    expect(services.connectionCoverage.conflicting).toBe(0);
    expect(exceptionRows(result)).toHaveLength(services.connectionCoverage.missing);
  });

  it('never counts an unverified connection as part of the affected set', () => {
    const affectedSet = result.sets.find((item) => item.id === 'valve-isolation/affected');
    expect(affectedSet).toBeDefined();
    const exceptionIds = exceptionRows(result).flatMap((row) => {
      const subjects = row['subjects'];
      return Array.isArray(subjects) ? subjects.filter((item): item is string => typeof item === 'string') : [];
    });
    expect(exceptionIds.length).toBeGreaterThan(0);
    if (affectedSet === undefined) return;
    for (const id of exceptionIds) expect(affectedSet.members.has(keyOf(input.model, id))).toBe(false);
  });

  it('leaves no exception when every connection is accepted topology', () => {
    const complete = generateServices({ ...defaultServicesOptions, fixturesPerBranch: 1, unverifiedRate: 0 });
    expect(complete.connectionCoverage.missing).toBe(0);
    const completeResult = valueOfResult(
      'generated valve isolation (complete)',
      runValveIsolation(isolationInputOf(complete)),
    );
    expect(exceptionRows(completeResult)).toEqual([]);
  });
});
