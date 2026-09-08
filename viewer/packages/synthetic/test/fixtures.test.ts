// The catalog and its snapshots.
//
// The snapshot test regenerates every default fixture and compares it against the JSON committed
// beside it, so a change to a generator shows up in review. To accept a deliberate change, run the
// suite once with SYNTHETIC_UPDATE_SNAPSHOTS=1 and commit the rewritten files.
//
// The comparison is on the text rather than on the parsed object, because reading JSON back gives
// `unknown` and turning that into a typed snapshot would need a cast, which this package does not
// use. Line endings are normalised first: the repository checks files out with CRLF on Windows.
//
// The suite also asserts what the plan promises about cost: every default fixture builds in well
// under a second. The bound is deliberately loose, because what matters is "fast enough that a test
// or a demo can build one whenever it likes", not a benchmark.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fixture, fixtureNames, fixtures, summaryOf, type FixtureName } from '../src/fixtures.js';
import { snapshotOf, snapshotText, type Snapshot } from './snapshot.js';

const snapshotDirectory = join(dirname(fileURLToPath(import.meta.url)), 'snapshots');
const updating = process.env['SYNTHETIC_UPDATE_SNAPSHOTS'] === '1';

// The path a fixture's snapshot is committed at.
const snapshotPath = (name: FixtureName): string => join(snapshotDirectory, `${name}.json`);

// The text committed for one fixture, with line endings normalised.
const storedText = (name: FixtureName): string => readFileSync(snapshotPath(name), 'utf8').replace(/\r\n/g, '\n');

// Writes the snapshot for one fixture.
function writeSnapshot(name: FixtureName, snapshot: Snapshot): void {
  if (!existsSync(snapshotDirectory)) mkdirSync(snapshotDirectory, { recursive: true });
  writeFileSync(snapshotPath(name), snapshotText(snapshot), 'utf8');
}

describe('the fixture catalog', () => {
  it('names every generator exactly once', () => {
    expect([...fixtureNames].sort()).toEqual(Object.keys(fixtures).sort());
    expect(new Set(fixtureNames).size).toBe(fixtureNames.length);
  });

  it('builds every fixture by name', () => {
    for (const name of fixtureNames) expect(fixture(name)).toBeDefined();
  });

  it('summarises every fixture', () => {
    for (const name of fixtureNames) {
      const summary = summaryOf(name);
      expect(summary.name).toBe(name);
      for (const [tableName, table] of summary.tables) {
        expect(tableName).not.toBe('');
        expect(table.columns.size).toBeGreaterThan(0);
      }
    }
  });

  it('gives the same fixture on every call', () => {
    for (const name of fixtureNames) {
      expect(snapshotOf(summaryOf(name))).toEqual(snapshotOf(summaryOf(name)));
    }
  });

  it('builds every default fixture in well under a second', () => {
    const slow: string[] = [];
    for (const name of fixtureNames) {
      const started = performance.now();
      fixture(name);
      const elapsed = performance.now() - started;
      if (elapsed >= 500) slow.push(`${name} took ${elapsed.toFixed(1)} ms`);
    }
    expect(slow).toEqual([]);
  });
});

describe('the fixture snapshots', () => {
  for (const name of fixtureNames) {
    it(`matches the committed snapshot for ${name}`, () => {
      const snapshot = snapshotOf(summaryOf(name));
      if (updating) {
        writeSnapshot(name, snapshot);
        return;
      }
      expect(snapshotText(snapshot)).toBe(storedText(name));
    });
  }
});
