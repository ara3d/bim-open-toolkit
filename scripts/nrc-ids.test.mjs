import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'nrc-ids.mjs');
const csv = readFileSync(resolve(here, '..', 'samples', 'nrc', 'nrc-metrics.csv'), 'utf8').replace(/\r\n/g, '\n');

function run(text) {
  const dir = mkdtempSync(join(tmpdir(), 'nrc-ids-'));
  const metrics = join(dir, 'metrics.csv');
  writeFileSync(metrics, text);
  return spawnSync(process.execPath, [script, '--metrics', metrics, '--out', join(dir, 'out.ids')], { encoding: 'utf8' });
}

const annual = 'NRC.OC.ANNUAL,element,NRC_OperationalCarbon,OperationalCarbon_kgCO2e_per_year,';

test('the committed dictionary is accepted', () => {
  assert.equal(run(csv).status, 0);
});

test('a blank PropertyName fails and names the row', () => {
  const r = run(csv.replace(annual, 'NRC.OC.ANNUAL,element,NRC_OperationalCarbon,,'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /row 4 \(NRC\.OC\.ANNUAL, element\): PropertyName is empty/);
});

test('a blank PropertySet fails', () => {
  const r = run(csv.replace(annual, 'NRC.OC.ANNUAL,element,,OperationalCarbon_kgCO2e_per_year,'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /PropertySet is empty/);
});

test('a missing column is named', () => {
  const r = run(csv.replace('PropertyName', 'Name'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no PropertyName column/);
});

test('a second element-level row for a metric fails', () => {
  const line = csv.split('\n').find((l) => l.startsWith(annual));
  const r = run(csv.replace(line, line + '\n' + line));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /2 element-level rows for NRC\.OC\.ANNUAL/);
});
