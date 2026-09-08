import { chromium } from 'playwright-core';
import { createServer } from 'vite';
const [demo, out] = process.argv.slice(2);
const server = await createServer({ configFile: 'packages/demos/vite.gallery.config.mjs', server: { port: 5196 } });
await server.listen();
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.on('pageerror', (e) => console.log('pageerror', String(e)));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto(`http://localhost:5196/gallery.html?demo=${demo}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
try {
  await page.waitForFunction('window.demo !== undefined && (window.demo.ready === true || typeof window.demo.error === "string")', undefined, { timeout: 180000 });
  await page.waitForTimeout(2500);
  console.log(JSON.stringify(await page.evaluate('({ error: window.demo?.error ?? null, report: window.demo?.report() ?? null, status: document.querySelector(".status-strip")?.textContent ?? null, panels: document.querySelectorAll(".gallery-viewport canvas").length, mirror: document.querySelectorAll(".mirror-control").length })'), null, 1));
  if (out) await ((await page.$('.gallery-viewport')) ?? page).screenshot({ path: out });
} catch (e) { console.log('FAILED', String(e).split('\n')[0]); }
await browser.close();
await server.close();
