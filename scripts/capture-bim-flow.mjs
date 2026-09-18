// Captures screenshots of BimOpenFlow pages from a list of capture specs, and
// writes a Markdown index with one caption per image. Used by the NRC walkthrough
// and usable alone against any running host and editor:
//
//   node scripts/capture-bim-flow.mjs --base http://127.0.0.1:5300 --spec captures.json --out artifacts/captures
//
// A spec is a JSON array of objects:
//   page      "3d.html" (default), "index.html", or "duckdb.html"
//   analysis  the analysis id to open (3d.html reads ?analysis=; the other pages use their picker)
//   node      the node to preview (3d.html's "Preview node" select); default: the page's own choice
//   pane      "view3d" | "table" | "chart" | "verdict": the pane tab to activate when present
//   file      output PNG name
//   caption   text for the index
//   fullPage  capture the whole page instead of the viewport (default false)
//   settleMs  extra wait after the pane is ready (default 1500)
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { root } from "./bim-flow-processes.mjs";

const VIEW_STATUS = ".bof-panes-viewstatus";

/** Waits for the 3D pane's status line to report loaded instances, or for a table/chart to draw. */
async function waitForPane(page, pane, timeout) {
  if (pane === "view3d") {
    await page.waitForFunction((sel) => /instances/.test(document.querySelector(sel)?.textContent ?? ""),
      VIEW_STATUS, { timeout });
    // Two frames so the renderer has drawn the loaded groups.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  } else if (pane) {
    await page.waitForFunction(() =>
      document.querySelector(".bof-panes-table tbody tr, .bof-panes-chart svg, .bof-panes-chart canvas, .bof-panes-verdict, [class*='bof-panes-'] table tr") !== null,
      {}, { timeout }).catch(() => { /* a pane without one of these classes still gets captured */ });
  }
}

/** Opens the analysis on the page, picks the node and pane, and screenshots. Returns the status text. */
export async function captureOne(page, base, spec, outDir, timeout = 180000) {
  const pageName = spec.page ?? "3d.html";
  const url = pageName === "3d.html" ? `${base}/3d.html?analysis=${encodeURIComponent(spec.analysis)}` : `${base}/${pageName}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (pageName !== "3d.html" && spec.analysis) {
    const picker = page.locator('select[aria-label="Open flow"]').first();
    await picker.waitFor({ timeout });
    await page.waitForFunction((id) => [...document.querySelector('select[aria-label="Open flow"]')?.options ?? []].some((o) => o.value === id),
      spec.analysis, { timeout });
    await picker.selectOption(spec.analysis);
  }
  if (spec.node) {
    const preview = page.locator('select[aria-label="Preview node"]').first();
    await preview.waitFor({ timeout });
    await page.waitForFunction((id) => [...document.querySelector('select[aria-label="Preview node"]')?.options ?? []].some((o) => o.value === id),
      spec.node, { timeout });
    await preview.selectOption(spec.node);
  }
  if (spec.pane) {
    const tab = page.locator(`.bof-app-tabs [data-kind="${spec.pane}"]`).first();
    if (await tab.count()) await tab.click();
  }
  // Frame the whole graph so the capture shows every node, not the corner the editor opened on.
  const fit = page.getByRole("button", { name: "Fit graph", exact: true });
  if (await fit.count()) await fit.first().click();
  await waitForPane(page, spec.pane, timeout);
  await page.waitForTimeout(spec.settleMs ?? 1500);
  const status = ((await page.locator(VIEW_STATUS).first().textContent({ timeout: 1000 }).catch(() => "")) ?? "").trim();
  await page.screenshot({ path: join(outDir, spec.file), fullPage: spec.fullPage ?? false });
  return status;
}

/** Runs every spec in order and writes `index.md` beside the images. */
export async function captureAll(browser, base, specs, outDir, { viewport = { width: 1440, height: 900 }, title = "Captures" } = {}) {
  await mkdir(outDir, { recursive: true });
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const results = [];
  for (const spec of specs) {
    const status = await captureOne(page, base, spec, outDir);
    console.log(`${spec.file}: ${status || "captured"}`);
    results.push({ ...spec, status });
  }
  await page.close();
  const lines = [`# ${title}`, "", `Captured ${new Date().toISOString()} from ${base}.`, ""];
  for (const r of results) {
    lines.push(`## ${r.file}`, "", `![${r.caption ?? r.file}](${r.file})`, "", r.caption ?? "");
    if (r.status) lines.push("", `Pane status: \`${r.status}\``);
    lines.push("");
  }
  if (errors.length) lines.push("## Page errors", "", ...errors.map((e) => `- ${e}`), "");
  await writeFile(join(outDir, "index.md"), lines.join("\n"));
  return { results, errors };
}

/** Playwright's Chromium from the viz workspace, using the installed Edge so no browser download is needed. */
export async function launchBrowser() {
  const { chromium } = await import(pathToFileURL(resolve(root, "viz/node_modules/playwright-core/index.mjs")).href);
  return chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
}

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = arg("--base", "http://127.0.0.1:5300");
  const specs = JSON.parse(await readFile(arg("--spec"), "utf8"));
  const out = resolve(arg("--out", "artifacts/captures"));
  const browser = await launchBrowser();
  try {
    const { errors } = await captureAll(browser, base, specs, out);
    if (errors.length) { console.error(`${errors.length} page error(s)`); process.exitCode = 1; }
  } finally {
    await browser.close();
  }
}
