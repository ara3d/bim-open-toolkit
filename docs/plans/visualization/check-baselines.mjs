import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url));
const hashes = JSON.parse(read('./baseline-hashes.json').toString('utf8'));
for (const [file, expected] of Object.entries(hashes)) {
  const actual = createHash('sha256').update(read(`./${file}`)).digest('hex');
  assert.equal(actual, expected, `Baseline changed: ${file}. Preserve the source; record revisions separately.`);
}

const brief = read('./PRODUCT-BRIEF.md').toString('utf8');
const plan = read('../../../viewer/packages/visualization/docs/PLAN.md').toString('utf8');
const features = brief.split(/\r?\n/).filter(line => /^### F\d\d\./.test(line)).map(line => line.slice(4));
assert.equal(features.length, 27, 'Expected the original F01–F27 catalog');
for (const feature of features) {
  assert.ok(plan.includes(feature), `Original feature/priority missing from plan: ${feature}`);
}
console.log('Planning baseline check passed: four exact archives and all 27 original feature priorities.');
