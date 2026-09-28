import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseClaudeCli, parseVersion, compareVersions } from './claude-login.mjs';

test('parseVersion accepts a dotted numeric folder name and rejects anything else', () => {
  assert.deepEqual(parseVersion('2.1.281'), [2, 1, 281]);
  assert.equal(parseVersion('latest'), null);
  assert.equal(parseVersion(undefined), null);
});

test('compareVersions orders numerically, not lexically, and pads the shorter one', () => {
  assert.equal(compareVersions([2, 1, 281], [2, 1, 280]), 1);
  assert.equal(compareVersions([2, 9], [2, 10]), -1); // lexical order would get this backwards
  assert.equal(compareVersions([2, 1], [2, 1, 0]), 0);
});

test('ASK_CLAUDE_CLI wins when it names a file that exists', () => {
  const result = chooseClaudeCli({
    override: { path: 'C:/custom/claude.exe', exists: true },
    onPath: { path: 'C:/path/claude.exe', runs: true },
    bundled: [{ root: 'appdata', version: '9.9.9', exe: 'C:/appdata/9.9.9/claude.exe' }],
  });
  assert.equal(result.path, 'C:/custom/claude.exe');
  assert.match(result.reason, /ASK_CLAUDE_CLI/);
});

test('a missing ASK_CLAUDE_CLI target fails outright rather than falling back', () => {
  const result = chooseClaudeCli({
    override: { path: 'C:/custom/claude.exe', exists: false },
    onPath: { path: 'C:/path/claude.exe', runs: true },
    bundled: [],
  });
  assert.equal(result.path, null);
  assert.match(result.reason, /missing file/);
});

test('a PATH hit that runs is used over any bundled copy', () => {
  const result = chooseClaudeCli({
    override: undefined,
    onPath: { path: 'C:/path/claude.exe', runs: true },
    bundled: [{ root: 'packaged', version: '2.1.281', exe: 'C:/packaged/2.1.281/claude.exe' }],
  });
  assert.equal(result.path, 'C:/path/claude.exe');
  assert.match(result.reason, /PATH/);
});

test('a PATH hit that does not run (the MSIX-virtualized launcher case) falls through to bundled', () => {
  const result = chooseClaudeCli({
    override: undefined,
    onPath: { path: 'C:/path/claude.exe', runs: false },
    bundled: [{ root: 'packaged', version: '2.1.281', exe: 'C:/packaged/2.1.281/claude.exe' }],
  });
  assert.equal(result.path, 'C:/packaged/2.1.281/claude.exe');
  assert.match(result.reason, /bundled/);
});

test('among several bundled copies across both roots, the numerically newest version wins', () => {
  const result = chooseClaudeCli({
    override: undefined,
    onPath: undefined,
    bundled: [
      { root: 'appdata', version: '2.1.280', exe: 'C:/appdata/2.1.280/claude.exe' },
      { root: 'packaged', version: '2.1.281', exe: 'C:/packaged/2.1.281/claude.exe' },
      { root: 'appdata', version: '2.9.0', exe: 'C:/appdata/2.9.0/claude.exe' },
    ],
  });
  assert.equal(result.path, 'C:/appdata/2.9.0/claude.exe');
});

test('nothing found reports every candidate looked at', () => {
  const result = chooseClaudeCli({ override: undefined, onPath: undefined, bundled: [] });
  assert.equal(result.path, null);
  assert.deepEqual(result.candidates, []);
});
