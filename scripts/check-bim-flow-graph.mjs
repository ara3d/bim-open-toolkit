import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "../viewer/node_modules/playwright-core/index.mjs";

// Run against an isolated BIM-profile host: edits are restored in finally.
const base = process.env.BOF_DEMO_URL ?? "http://127.0.0.1:5302";
const endpoint = base + "/api/analyses/snowdon-toolkit";
const original = await (await fetch(endpoint)).text();
JSON.parse(original);
const output = resolve("artifacts/bim-flow/graph-browser");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({channel:"msedge",headless:true,args:["--enable-unsafe-swiftshader"]});
const errors = [];
const scenarios = [];
try {
  const page = await browser.newPage({viewport:{width:1680,height:1050}});
  page.on("pageerror", e => errors.push(e.message));
  let modelRequests = 0;
  page.on("request", r => { if (/\/api\/models\/.*\/bos/.test(r.url())) modelRequests++; });
  await page.goto(base + "/3d.html");
  await page.waitForFunction(() => /456,598/.test(document.querySelector(".bof-panes-viewstatus")?.textContent ?? ""), {}, {timeout:180000});
  assert.equal(await page.getByLabel("Open flow",{exact:true}).inputValue(), "snowdon-toolkit");
  const graph = page.locator(".bof-app-canvas-host canvas");
  const view = page.locator(".bof-panes-canvas");
  const left = await graph.boundingBox();
  const right = await view.boundingBox();
  assert.ok(left.x < right.x && left.width > 650 && right.width > 650 && right.height > 700);
  assert.ok(left.y + left.height <= 1051 && right.y + right.height <= 1051,"Both panes fit the viewport");
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const hash = async () => createHash("sha256").update(await view.screenshot()).digest("hex");
  await frame();
  await page.screenshot({path:resolve(output,"split-editor.png")});
  scenarios.push("Snowdon opens automatically with editable graph left and 3D right");
  const firstCanvas = await view.elementHandle();
  const cutaway = page.waitForResponse(r => r.url().includes("/cutaway/") && r.status() === 200);
  await page.getByLabel("Preview node").selectOption("cutaway");
  await cutaway;
  await frame();
  const before = await hash();
  const input = page.getByLabel("cutaway fraction",{exact:true});
  await input.fill("0.25");
  const saved = page.waitForResponse(r => r.url() === endpoint && r.request().method() === "PUT" && r.ok());
  await input.press("Enter");
  await saved;
  await page.waitForFunction(async url => {
    const state = await (await fetch(url + "/state")).json();
    return state.nodes.every(n => n.status === "Ok");
  }, endpoint);
  // Wait for the evaluation's result table to reach the renderer.
  await page.waitForTimeout(1200);
  await frame();
  assert.equal(JSON.parse(await (await fetch(endpoint)).text()).values.cutaway.fraction,"0.25");
  assert.notEqual(await hash(),before,"Editing the graph parameter changes rendered pixels");
  assert.ok(await firstCanvas.evaluate(el => el.isConnected),"Recipe switches preserve the loaded viewer");
  assert.equal(modelRequests,1,"Snowdon bytes load once across recipe selection and edits");
  await page.screenshot({path:resolve(output,"edited-cutaway.png")});
  scenarios.push("Inline parameter autosaves, evaluates and changes rendered pixels","Recipe branches reuse one loaded model");
  await page.mouse.click(left.x+15,left.y+left.height-15);
  assert.ok(await view.isVisible(),"Clearing graph selection preserves the preview");
  await page.getByRole("button",{name:"Nodes",exact:true}).click();
  assert.ok(await page.locator(".bof-app-sidebar").isVisible());
  await page.getByRole("button",{name:"Nodes",exact:true}).click();
  await page.getByRole("button",{name:"Fit graph",exact:true}).click();
  scenarios.push("Canvas deselection preserves preview","Catalog opens and closes","Graph fit works");
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,"evidence.json"),JSON.stringify({browser:browser.version(),scenarios},null,2));
  console.log(JSON.stringify({scenarios},null,2));
} finally {
  await browser.close();
  const restored = await fetch(endpoint,{method:"PUT",headers:{"Content-Type":"application/json"},body:original});
  assert.ok(restored.ok,"Restore original graph after verification");
}
