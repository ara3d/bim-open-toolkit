// Checks the built NRC walkthrough site the way GitHub Pages serves it: plain files under
// artifacts/nrc-site, served under a sub-path as the real site is, no dev server, no host. Opens
// nrc.html and every notebook it lists in a headless browser and fails on
//   - an uncaught exception, a console error, a failed request, or a response of 400 or more;
//   - a landing page with fewer cards than the catalog has notebooks, no graph rows, a problem
//     line, no static-copy box, or a link that needs a host or the editor;
//   - the private Snowdon notebook being on the site;
//   - a notebook that shows fewer turns than its catalog entry, a "could not open" box, no link to
//     NOTICE.md, or an "Open in editor" link;
//   - a 3D view that does not draw its recorded model (each is scrolled into view, which mounts
//     it, and must report its rendered instances).
//
// Usage, from the repository root, after
//   npm run build:pages -w @bimopenflow/nrc-web --prefix bimopenflow/web
//   node gates/nrc-pages-smoke.mjs                      headless Edge
//   node gates/nrc-pages-smoke.mjs --screenshots <dir>  also saves landing.png and <notebook>.png
//   node gates/nrc-pages-smoke.mjs --only a,b           opens only the notebooks named a and b
// NRC_PAGES_BROWSER_CHANNEL picks another installed browser (CI uses chrome); NRC_PAGES_PORT the
// port. playwright-core is found in PLAYWRIGHT_CORE (a folder whose node_modules has it), the
// repository root, bimopenflow/web, or the notebook repository's workspace under deps/.
//
// Modelled on bim-open-notebook's gates/pages-smoke.mjs.

import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "artifacts", "nrc-site");
const catalogFile = join(site, "notebooks", "catalog.json");
/** The folder the site is served under, as GitHub Pages serves it at /nrc-ifc-llm/; a path bug shows up here. */
const prefix = "/nrc-ifc-llm";
/** The notebook that must never be on the site: its model is private. */
const PRIVATE = "s10-snowdon";

/** playwright-core from the first place that has it. */
function loadPlaywright() {
  const places = [process.env.PLAYWRIGHT_CORE, root, join(root, "bimopenflow", "web"), join(root, "deps", "bim-open-notebook", "bimopenflow", "web")];
  for (const place of places) {
    if (!place) continue;
    try {
      return createRequire(join(place, "package.json"))("playwright-core");
    } catch {
      // try the next place
    }
  }
  throw new Error("playwright-core is not installed: run `npm ci` in bimopenflow/web (playwright-core is a devDependency there), or set PLAYWRIGHT_CORE to a folder whose node_modules has it");
}

const port = Number(process.env.NRC_PAGES_PORT ?? 5356);
const channel = process.env.NRC_PAGES_BROWSER_CHANNEL ?? "msedge";
const shotsArg = process.argv.indexOf("--screenshots");
const shots = shotsArg < 0 ? undefined : resolve(process.argv[shotsArg + 1] ?? "artifacts/nrc-site-shots");
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg < 0 ? undefined : new Set((process.argv[onlyArg + 1] ?? "").split(","));
const timeoutMs = 60_000;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".wasm": "application/wasm", ".woff2": "font/woff2", ".bos": "application/octet-stream",
};

/** Serves the site folder under `prefix`, as GitHub Pages does: a folder answers with its index.html. */
function serve() {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    if (path !== prefix && !path.startsWith(`${prefix}/`)) { res.writeHead(404).end(); return; }
    let file = normalize(join(site, path.slice(prefix.length)));
    if (!file.startsWith(site + sep) && file !== site) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => server.listen(port, "127.0.0.1", () => done(server)));
}

/** Every problem a page reports. */
function watch(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`exception: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  page.on("requestfailed", (request) => errors.push(`request failed: ${request.url()} (${request.failure()?.errorText ?? ""})`));
  return errors;
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((done) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(done)), 500)));
}

/**
 * Scrolls each 3D view into the viewport, which mounts its pane, and waits until the pane reports
 * its rendered instances or an error. The static site records the model file and the rows of each
 * view, so every one must draw; the hostless "needs a host" placeholder counts as a failure.
 */
async function drawViews(page) {
  const count = await page.evaluate(() => document.querySelectorAll(".bof-nb-view3d").length);
  const views = [];
  for (let index = 0; index < count; index++) {
    await page.evaluate((i) => document.querySelectorAll(".bof-nb-view3d")[i].scrollIntoView({ block: "center" }), index);
    const status = await page
      .waitForFunction((i) => {
        const figure = document.querySelectorAll(".bof-nb-view3d")[i];
        const pane = figure.querySelector(".bof-panes-viewstatus")?.textContent ?? "";
        const own = figure.querySelector(".bof-nb-view3d-status");
        if (/rendered instances/.test(pane)) return pane;
        if (own?.getAttribute("role") === "alert") return `error: ${own.textContent}`;
        if (/^(Error|TypeError|RangeError)\b/.test(pane) || figure.querySelector('.bof-panes-viewstatus[role="alert"]')) return `error: ${pane}`;
        if (figure.querySelector("button")?.disabled) return `error: ${own?.textContent ?? "disabled"}`;
        if (/only its description/.test(figure.textContent ?? "")) return `error: ${figure.textContent}`;
        return false;
      }, index, { timeout: timeoutMs })
      .then((handle) => handle.jsonValue())
      .catch(() => "error: timed out waiting for the view to draw");
    views.push({ index, status, ok: !status.startsWith("error:") });
  }
  return views;
}

const t0 = Date.now();
const stamp = (what) => { if (process.env.NRC_PAGES_TRACE) console.log(`[${Math.round((Date.now() - t0) / 1000)} s] ${what}`); };

async function main() {
  if (!existsSync(catalogFile)) throw new Error(`${catalogFile} is missing; run npm run build:pages -w @bimopenflow/nrc-web --prefix bimopenflow/web first`);
  const { chromium } = loadPlaywright();
  const catalog = JSON.parse(readFileSync(catalogFile, "utf8"));
  const turnsOf = new Map(catalog.map((entry) => [entry.name, entry.turns]));
  if (shots) mkdirSync(shots, { recursive: true });

  stamp("start");
  const server = await serve();
  const origin = `http://127.0.0.1:${port}${prefix}`;
  const browser = await chromium.launch({ channel, headless: true });
  stamp("browser launched");
  const failures = [];
  try {
    if (catalog.some((entry) => entry.name.startsWith(PRIVATE))) failures.push(`catalog: lists ${PRIVATE}, whose model is private`);
    if (existsSync(join(site, "notebooks", `${PRIVATE}.notebook.json`))) failures.push(`site: ships ${PRIVATE}.notebook.json`);

    // The landing page: one card per catalog entry, graph rows, and no link that needs a host.
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const landingErrors = watch(page);
    await page.goto(`${origin}/nrc.html`, { waitUntil: "load" });
    await page.waitForSelector(".nrc-card", { timeout: timeoutMs }).catch(() => {});
    await page.waitForSelector(".nrc-table tr[data-analysis]", { timeout: 5_000 }).catch(() => {});
    const cards = await page.$$eval(".nrc-card", (links) => links.map((a) => new URL(a.href).searchParams.get("notebook")));
    const graphRows = await page.$$eval(".nrc-table tr[data-analysis]", (rows) => rows.length);
    const problems = await page.$$eval(".nrc-problem", (nodes) => nodes.map((n) => n.textContent));
    const hostLinks = await page.$$eval("a[href]", (links) => links.map((a) => a.href).filter((h) => new URL(h).host !== location.host && /^https?:\/\/(127\.0\.0\.1|localhost)/.test(h)));
    const strayLinks = await page.$$eval(".nrc-open a", (links) => links.map((a) => a.getAttribute("href")).filter((h) => !/^notebook\.html\?notebook=/.test(h ?? "")));
    const staticBoxes = await page.$$eval(".nrc-static", (boxes) => boxes.length);
    if (cards.length !== catalog.length) failures.push(`landing: ${cards.length} cards for ${catalog.length} catalog entries`);
    if (graphRows === 0) failures.push("landing: the graph table has no rows");
    if (staticBoxes !== 1) failures.push("landing: the static-copy box (omitted notebook, local-host commands) is missing");
    for (const problem of problems) failures.push(`landing: problem shown: ${problem}`);
    for (const href of hostLinks) failures.push(`landing: link to a local host: ${href}`);
    for (const href of strayLinks) failures.push(`landing: graph link that is not a notebook: ${href}`);
    stamp("landing loaded");
    await settle(page);
    if (shots) await page.screenshot({ path: join(shots, "landing.png"), fullPage: true });
    console.log(`landing: ${cards.length} notebooks listed, ${graphRows} graph rows`);
    for (const message of landingErrors) failures.push(`landing: ${message}`);
    // The site root sends a visitor to the landing page.
    const index = await page.request.get(`${origin}/`);
    if (!index.ok() || !(await index.text()).includes("url=nrc.html")) failures.push("index.html does not send visitors to nrc.html");
    // The node catalog the graph cells place their ports from: shipped, parseable, and not empty.
    const catalogResponse = await page.request.get(`${origin}/notebooks/node-catalog.json`);
    const nodeKinds = catalogResponse.ok() ? (await catalogResponse.json()).nodes?.length ?? 0 : 0;
    if (nodeKinds === 0) failures.push(`node catalog: notebooks/node-catalog.json ${catalogResponse.ok() ? "has no nodes" : `answered ${catalogResponse.status()}`}`);
    else console.log(`ok   node catalog: ${nodeKinds} kinds`);
    stamp("landing checked");
    await page.close();
    if (catalog.length < 3) failures.push(`catalog: ${catalog.length} notebooks, expected at least 3`);

    // Each notebook: every turn drawn, no problems box, the hostless note linking NOTICE.md, no editor links.
    for (const name of cards.filter((n) => !only || only.has(n))) {
      const started = Date.now();
      const one = await browser.newPage({ viewport: { width: 1200, height: 900 } });
      const errors = watch(one);
      try {
        await one.goto(`${origin}/notebook.html?notebook=${encodeURIComponent(name)}`, { waitUntil: "load" });
        const turns = turnsOf.get(name) ?? 1;
        await one.waitForFunction((n) => document.querySelectorAll(".nb-turn").length >= n || document.querySelector(".nb-problems") !== null, turns, { timeout: timeoutMs });
        await settle(one);
        const seen = await one.evaluate(() => ({
          turns: document.querySelectorAll(".nb-turn").length,
          embeds: document.querySelectorAll(".nb-embed").length,
          problems: [...document.querySelectorAll(".nb-problems")].map((p) => p.textContent),
          notice: document.querySelector('.nb-ask-note a[href="NOTICE.md"]') !== null,
          editorLinks: document.querySelectorAll("a.notebook-graph-open").length,
        }));
        if (seen.problems.length > 0) throw new Error(seen.problems.join("; "));
        if (seen.turns !== turns) throw new Error(`${seen.turns} turns drawn, catalog says ${turns}`);
        if (!seen.notice) throw new Error("the hostless note does not link NOTICE.md");
        if (seen.editorLinks > 0) throw new Error(`${seen.editorLinks} "Open in editor" links, which need a host`);
        const views = await drawViews(one);
        for (const view of views) if (!view.ok) throw new Error(`3D view ${view.index + 1}: ${view.status}`);
        if (shots) {
          await one.evaluate(() => window.scrollTo(0, 0));
          // The top of the notebook, with the sticky request box moved to the end so it covers nothing.
          await one.addStyleTag({ content: ".nb-ask { position: static !important; }" });
          await settle(one);
          await one.screenshot({ path: join(shots, `${name}.png`) });
        }
        console.log(`ok   ${name} (${Math.round((Date.now() - started) / 1000)} s): ${seen.turns} turns, ${seen.embeds} embeds, ${views.length} 3D view${views.length === 1 ? "" : "s"} drawn${views.map((v) => ` (${v.status.replace(/ · .*$/, "")})`).join("")}`);
      } catch (cause) {
        failures.push(`${name}: ${cause instanceof Error ? cause.message : String(cause)}`);
        console.log(`FAIL ${name} (${Math.round((Date.now() - started) / 1000)} s)`);
      }
      for (const message of errors) failures.push(`${name}: ${message}`);
      await one.close();
    }
  } finally {
    stamp("notebooks done");
    // Closing a browser can take minutes on a busy machine; the verdict does not depend on it.
    await Promise.race([browser.close().catch(() => {}), new Promise((done) => setTimeout(done, 30_000))]);
    stamp("browser closed");
    await new Promise((done) => server.close(done));
  }
  for (const failure of failures) console.log(`  ${failure}`);
  console.log(failures.length === 0 ? "NRC PAGES SMOKE: PASS" : `NRC PAGES SMOKE: FAIL (${failures.length} problems)`);
  process.exit(failures.length === 0 ? 0 : 1);
}

await main();
