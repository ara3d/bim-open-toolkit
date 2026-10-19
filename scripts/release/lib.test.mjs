// node --test scripts/release/lib.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { filesUnder, mergeTree } from "./lib.mjs";
import { bundledNpmPackages } from "./notices.mjs";

const scratch = () => mkdtempSync(join(tmpdir(), "release-lib-"));
const put = (dir, name, text) => {
  mkdirSync(join(dir, name, ".."), { recursive: true });
  writeFileSync(join(dir, name), text);
};

test("mergeTree copies new files and accepts identical ones", () => {
  const [a, b] = [scratch(), scratch()];
  put(a, "x.txt", "one");
  put(a, "sub/y.txt", "two");
  put(b, "x.txt", "one");
  assert.deepEqual(mergeTree(a, b), []);
  assert.deepEqual(filesUnder(b).sort(), ["sub\\y.txt", "x.txt"]);
  [a, b].forEach((d) => rmSync(d, { recursive: true }));
});

test("mergeTree reports a file whose bytes differ and keeps the first", () => {
  const [a, b] = [scratch(), scratch()];
  put(a, "x.txt", "new");
  put(b, "x.txt", "old");
  assert.deepEqual(mergeTree(a, b), ["x.txt"]);
  assert.equal(readFileSync(join(b, "x.txt"), "utf8"), "old");
  [a, b].forEach((d) => rmSync(d, { recursive: true }));
});

test("mergeTree skips what the caller excludes", () => {
  const [a, b] = [scratch(), scratch()];
  put(a, "assets/app.js", "js");
  put(a, "assets/app.js.map", "map");
  assert.deepEqual(mergeTree(a, b, (f) => f.endsWith(".map")), []);
  assert.deepEqual(filesUnder(b), ["assets\\app.js"]);
  [a, b].forEach((d) => rmSync(d, { recursive: true }));
});

test("bundledNpmPackages names each package in the source maps, scoped ones whole", () => {
  const dir = scratch();
  put(dir, "assets/a.js.map", JSON.stringify({ sources: ["../node_modules/three/build/three.js", "../../node_modules/@scope/pkg/index.js", "../src/own.ts"] }));
  put(dir, "assets/b.js.map", JSON.stringify({ sources: ["../node_modules/three/src/x.js", "../node_modules/a/node_modules/b/i.js"] }));
  assert.deepEqual(bundledNpmPackages([dir]), ["@scope/pkg", "a", "b", "three"]);
  rmSync(dir, { recursive: true });
});
