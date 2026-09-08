import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upgradeDuckDbGraph } from './duckdb-graph.mjs';

test('migration shares paths, preserves edits and is idempotent', () => {
  const original = {
    structure: { nodes: [{ id: 'q1', kind: 'duck.query' }, { id: 'q2', kind: 'duck.query' }, { id: 'q3', kind: 'duck.query' }, { id: 'sort', kind: 'table.sort' }], edges: [{ from: 'q1.table', to: 'sort.table' }] },
    values: { q1: { path: 'a.duckdb', sql: 'SELECT custom FROM door' }, q2: { path: 'a.duckdb', sql: 'SELECT * FROM storey' }, q3: { path: 'b.duckdb', sql: 'SELECT 1' }, sort: { by: 'Name, Count desc, Level asc' } },
    layout: { q1: { x: 44, y: 88 } },
  };
  const upgraded = upgradeDuckDbGraph(original);
  assert.equal(upgraded.structure.nodes.filter(node => node.kind === 'duck.source').length, 2);
  assert.equal(upgraded.structure.edges.find(edge => edge.to === 'q1.source').from, upgraded.structure.edges.find(edge => edge.to === 'q2.source').from);
  assert.equal(upgraded.values.q1.sql, original.values.q1.sql);
  assert.equal(upgraded.values.q1.path, undefined);
  assert.deepEqual(upgraded.values.sort, { A: 'Name', descendingA: 'false', B: 'Count', descendingB: 'true', C: 'Level', descendingC: 'false' });
  assert.deepEqual(upgraded.layout, original.layout);
  assert.equal(original.values.q1.path, 'a.duckdb');
  assert.deepEqual(upgradeDuckDbGraph(upgraded), upgraded);
});
