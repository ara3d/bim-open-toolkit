import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewritePlaceholder, upgradeDuckDbGraph } from './duckdb-graph.mjs';

test('migration shares paths, preserves edits and is idempotent', () => {
  const original = {
    structure: { nodes: [{ id: 'q1', kind: 'duck.query' }, { id: 'q2', kind: 'duck.query' }, { id: 'q3', kind: 'duck.query' }, { id: 'sort', kind: 'table.sort' }], edges: [{ from: 'q1.table', to: 'sort.table' }] },
    values: { q1: { path: 'a.duckdb', sql: 'SELECT custom FROM door' }, q2: { path: 'a.duckdb', sql: 'SELECT * FROM storey' }, q3: { path: 'b.duckdb', sql: 'SELECT 1' }, sort: { by: 'Name, Count desc, Level asc' } },
    layout: { q1: { x: 44, y: 88 } },
  };
  const upgraded = upgradeDuckDbGraph(original);
  assert.equal(upgraded.structure.nodes.filter(node => node.kind === 'duck.source').length, 2);
  assert.equal(upgraded.structure.edges.find(edge => edge.to === 'q1.path').from, upgraded.structure.edges.find(edge => edge.to === 'q2.path').from);
  assert.equal(upgraded.values.q1.sql, original.values.q1.sql);
  assert.equal(upgraded.values.q1.path, undefined);
  assert.deepEqual(upgraded.values.sort, { A: 'Name', descendingA: 'false', B: 'Count', descendingB: 'true', C: 'Level', descendingC: 'false' });
  assert.deepEqual(upgraded.layout, original.layout);
  assert.equal(original.values.q1.path, 'a.duckdb');
  assert.deepEqual(upgradeDuckDbGraph(upgraded), upgraded);
});

test('placeholder rewrite reaches parameter values and input defaults', () => {
  const original = {
    structure: { inputs: [{ name: 'model', kind: 'FilePath', default: '{DUCKDB}' }], nodes: [], edges: [] },
    values: { database: { path: '$model' }, other: { path: '{DUCKDB}', sql: 'SELECT 1' } },
  };
  const rewritten = rewritePlaceholder(original, '{DUCKDB}', 'C:\\data\\snowdon.duckdb');
  assert.equal(rewritten.structure.inputs[0].default, 'C:/data/snowdon.duckdb');
  assert.equal(rewritten.values.other.path, 'C:/data/snowdon.duckdb');
  assert.equal(rewritten.values.database.path, '$model');
  assert.equal(original.structure.inputs[0].default, '{DUCKDB}');
  assert.deepEqual(rewritePlaceholder(original, '{PUBLIC_DUCKDB}', 'x'), original);
});
