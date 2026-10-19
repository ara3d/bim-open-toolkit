// Opens the live NRC pages of a running release host in a headless browser: the landing page, then each
// notebook, where it waits for every turn and 3D view to draw, clicks "Re-evaluate all", and reads the
// tally the page reports ("5 current, 0 changed, 0 unavailable"). Fails on a console error, a failed
// request, a 3D view that does not draw, or an embed that is unavailable or changed.
//
//   node scripts/release/live-pages-smoke.mjs http://127.0.0.1:5214 [--only nrc-eight-questions,s14-door-bcf] [--screenshots dir]
//
// One kind of change is reported and not failed. A graph embed whose hash alone changed ("bf4f21930c2 -> 522c50b2dae")
// has the same body: the notebook recorded the graph with the paths of the machine that made it, and the host hashes
// it with the paths of the folder it runs from. That is how the notebooks measure freshness, not a defect of the release.
//
// A second kind is reported too: a table of the same size whose rows differ. The sample graphs sort by a value with ties
// (two IFC types with 184 instances each), and the order of tied rows is not fixed from one evaluation to the next.
//
// The static counterpart, which checks the Pages build with no host, is gates/nrc-pages-smoke.mjs.
// NRC_PAGES_BROWSER_CHANNEL picks the browser (default msedge; CI uses chrome).
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { root } from "./lib.mjs";

const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!base.startsWith("http")) {
  console.error("usage: node scripts/release/live-pages-smoke.mjs <host url> [--only a,b] [--screenshots dir]");
  process.exit(2);
}
const argument = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const only = argument("--only")?.split(",");
const shots = argument("--screenshots") ? resolve(argument("--screenshots")) : undefined;
if (shots) mkdirSync(shots, { recursive: true });
const timeout = 90_000;
const HASH_ONLY = /^[0-9a-f]{12} .{1,3} [0-9a-f]{12}$/;
const SAME_SHAPE = /^(\d+ rows? . \d+ columns?) .{1,3} \1$/;

function loadPlaywright() {
  for (const place of [process.env.PLAYWRIGHT_CORE, root, join(root, "bimopenflow", "web")]) {
    if (!place) continue;
    try {
      return createRequire(join(place, "package.json"))("playwright-core");
    } catch {
      // try the next place
    }
  }
  throw new Error("playwright-core is not installed: run npm ci in bimopenflow/web");
}

const failures = [];
const watch = (page, label) => {
  page.on("pageerror", (e) => failures.push(`${label}: exception: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") failures.push(`${label}: console: ${m.text()}`); });
  page.on("response", (r) => { if (r.status() >= 400) failures.push(`${label}: HTTP ${r.status()} ${r.url()}`); });
  page.on("requestfailed", (r) => failures.push(`${label}: request failed ${r.url()}`));
};

/** Scrolls each 3D view into view and waits until it reports its rendered instances or an error. */
async function drawViews(page) {
  const count = await page.evaluate(() => document.querySelectorAll(".bof-nb-view3d").length);
  const results = [];
  for (let i = 0; i < count; i++) {
    await page.evaluate((n) => document.querySelectorAll(".bof-nb-view3d")[n].scrollIntoView({ block: "center" }), i);
    results.push(await page.waitForFunction((n) => {
      const figure = document.querySelectorAll(".bof-nb-view3d")[n];
      const pane = figure.querySelector(".bof-panes-viewstatus")?.textContent ?? "";
      if (/rendered instances/.test(pane)) return pane;
      if (figure.querySelector('[role="alert"]')) return `error: ${figure.querySelector('[role="alert"]').textContent}`;
      return false;
    }, i, { timeout }).then((h) => h.jsonValue()).catch(() => "error: timed out"));
  }
  return results;
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ channel: process.env.NRC_PAGES_BROWSER_CHANNEL ?? "msedge", headless: true });
try {
  const landing = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  watch(landing, "nrc.html");
  await landing.goto(`${base}/nrc.html`, { waitUntil: "load" });
  await landing.waitForSelector(".nrc-card", { timeout });
  await landing.waitForSelector(".nrc-table tr[data-analysis]", { timeout }).catch(() => {});
  const cards = await landing.$$eval(".nrc-card", (links) => links.map((a) => new URL(a.href).searchParams.get("notebook")));
  const rows = await landing.$$eval(".nrc-table tr[data-analysis]", (r) => r.length);
  console.log(`landing: ${cards.length} notebooks, ${rows} graph rows`);
  if (cards.length < 10) failures.push(`landing: only ${cards.length} notebook cards`);
  if (rows === 0) failures.push("landing: no graph rows");
  if (cards.some((c) => /snowdon/i.test(c ?? ""))) failures.push("landing: lists a Snowdon notebook");
  await landing.close();

  for (const name of cards.filter((c) => !only || only.includes(c))) {
    const started = Date.now();
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    watch(page, name);
    try {
      await page.goto(`${base}/notebook.html?notebook=${encodeURIComponent(name)}`, { waitUntil: "load" });
      await page.waitForSelector(".nb-turn", { timeout });
      const problems = await page.$$eval(".nb-problems", (p) => p.map((n) => n.textContent));
      if (problems.length) throw new Error(problems.join("; "));
      const views = await drawViews(page);
      const bad = views.filter((v) => v.startsWith("error"));
      if (bad.length) throw new Error(`3D view: ${bad[0]}`);
      await page.click(".nb-refresh");
      const tally = await page.waitForFunction(() => {
        const text = document.querySelector(".nb-status")?.textContent ?? "";
        return /\d+ current, \d+ changed, \d+ unavailable/.test(text) ? text : false;
      }, undefined, { timeout }).then((h) => h.jsonValue());
      const badges = await page.$$eval(".nb-badge-changed, .nb-badge-unavailable", (b) => b.map((e) => ({ text: e.textContent ?? "", title: e.title })));
      const hashOnly = badges.filter((b) => HASH_ONLY.test(b.text));
      const sameShape = badges.filter((b) => SAME_SHAPE.test(b.text));
      const real = badges.filter((b) => !hashOnly.includes(b) && !sameShape.includes(b));
      for (const badge of real) failures.push(`${name}: ${badge.text}${badge.title ? ` (${badge.title})` : ""}`);
      if (shots) await page.screenshot({ path: join(shots, `${name}.png`), fullPage: false });
      const note = (hashOnly.length > 0 ? `; ${hashOnly.length} graph embed${hashOnly.length === 1 ? "" : "s"} differ in hash only` : "")
        + (sameShape.length > 0 ? `; ${sameShape.length} table${sameShape.length === 1 ? "" : "s"} of the same shape with other rows (ties in a sort)` : "");
      console.log(`${real.length === 0 ? "ok  " : "FAIL"} ${name} (${Math.round((Date.now() - started) / 1000)} s): ${views.length} 3D views drawn; ${tally}${note}`);
    } catch (cause) {
      failures.push(`${name}: ${cause instanceof Error ? cause.message : String(cause)}`);
      console.log(`FAIL ${name}`);
    }
    await page.close();
  }
} finally {
  await Promise.race([browser.close().catch(() => {}), new Promise((done) => setTimeout(done, 30_000))]);
}
failures.forEach((f) => console.log(`  ${f}`));
console.log(failures.length === 0 ? "LIVE PAGES SMOKE: PASS" : `LIVE PAGES SMOKE: FAIL (${failures.length})`);
process.exit(failures.length === 0 ? 0 : 1);
