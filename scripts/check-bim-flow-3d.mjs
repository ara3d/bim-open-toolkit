import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "../viewer/node_modules/playwright-core/index.mjs";

const base = process.env.BOF_DEMO_URL ?? "http://127.0.0.1:5302";
const fixture = process.env.BOF_SNOWDON_BFAST ?? "artifacts/bim-flow/snowdon.bfast";
const output = resolve("artifacts/bim-flow/browser");
await mkdir(output, { recursive: true });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const expected = await readFile(fixture);
const response = await fetch(base + "/__bimflow/snowdon.bfast");
assert.equal(response.status, 200);
assert.match(response.headers.get("content-type") ?? "", /octet-stream/);
const served = new Uint8Array(await response.arrayBuffer());
assert.equal(hash(served), hash(expected), "The endpoint must serve the actual model bytes.");
assert.deepEqual(served.slice(0,16), new Uint8Array(expected.subarray(0,16)));
const browser = await chromium.launch({channel:"msedge",headless:true,args:["--enable-unsafe-swiftshader"]});
const errors = [];
const evidence = { modelBytes: served.length, sha256: hash(served), browser: browser.version(), viewport:{width:1440,height:1000}, scenarios:[] };
try {
  const page = await browser.newPage({viewport:evidence.viewport,acceptDownloads:true});
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/3d.html");
  await page.waitForFunction(() => /instances/.test(document.querySelector(".bof-panes-viewstatus")?.textContent ?? ""), {}, {timeout:180000});
  assert.match(await page.locator(".bof-panes-viewstatus").innerText(), /456,598/);
  const canvas = page.locator("#viewer canvas");
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await frame();
  const original = hash(await canvas.screenshot());
  for (const name of ["Category atlas","Building cutaway","Interior section box","Exploded categories","Plan inspection","Ghosted presentation"]) {
    await page.getByRole("button",{name:new RegExp(name)}).click();
    await frame();
    assert.equal(await page.locator('[role="alert"]').count(),0,name);
    assert.notEqual(hash(await canvas.screenshot()), original, name + " changes rendered pixels");
    await page.screenshot({path:resolve(output,name.replaceAll(" ","-")+".png")});
    evidence.scenarios.push(name);
  }
  await page.getByRole("button",{name:"Reset view",exact:true}).click();
  await frame();
  assert.equal(hash(await canvas.screenshot()),original,"Reset restores source materials, layout, camera and environment.");
  const bounds = await canvas.boundingBox();
  for (const [x,y] of [[.5,.65],[.65,.7],[.4,.7]]) {
    await page.mouse.click(bounds.x+bounds.width*x,bounds.y+bounds.height*y);
    if ((await page.locator("#picked").innerText()).startsWith("Entity ")) break;
  }
  assert.match(await page.locator("#picked").innerText(),/^Entity \d+/);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button",{name:"Save PNG",exact:true}).click();
  const capture = await downloaded;
  await capture.saveAs(resolve(output,"capture.png"));
  const png = await readFile(resolve(output,"capture.png"));
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  evidence.scenarios.push("Reset to original pixels","Source-identity picking","PNG capture");
  await page.route("**/__bimflow/snowdon.bfast", route => route.fulfill({status:200,contentType:"text/html",body:"<!doctype html><title>Fallback</title>"}));
  await page.getByRole("button",{name:"Retry model",exact:true}).click();
  await page.locator('[role="alert"]').waitFor({timeout:60000});
  assert.ok((await page.locator('[role="alert"]').innerText()).length>10);
  await page.unroute("**/__bimflow/snowdon.bfast");
  await page.getByRole("button",{name:"Retry model",exact:true}).click();
  await page.waitForFunction(() => /instances/.test(document.querySelector(".bof-panes-viewstatus")?.textContent ?? ""), {}, {timeout:180000});
  evidence.scenarios.push("HTML fallback rejected visibly","Retry recovers");
  assert.deepEqual(errors,[]);
  await page.setViewportSize({width:780,height:1050});
  await frame();
  assert.ok(await canvas.isVisible());
  await page.screenshot({path:resolve(output,"responsive.png")});
  evidence.scenarios.push("Responsive resize");
  // The live editor path: C# recipe output -> paged API -> pane -> toolkit renderer.
  const stateResponse = await fetch(base + "/api/analyses/snowdon-toolkit/state");
  assert.equal(stateResponse.status, 200, "Start the BIM-profile host and seed snowdon-toolkit.");
  const state = await stateResponse.json();
  assert.equal(state.nodes.length, 9);
  assert.ok(state.nodes.every(node => node.status === "Ok"));
  await page.setViewportSize({width:1680,height:1100});
  await page.goto(base);
  await page.locator(".bof-app-topbar select").first().selectOption("snowdon-toolkit");
  await page.waitForTimeout(1000);
  const graphCanvas = await page.locator("canvas").first().boundingBox();
  const graph = await (await fetch(base + "/api/analyses/snowdon-toolkit")).json();
  const cutaway = graph.layout.cutaway;
  await page.mouse.click(graphCanvas.x+cutaway.x+30,graphCanvas.y+cutaway.y+14);
  await page.waitForFunction(() => /instances/.test(document.querySelector(".bof-panes-viewstatus")?.textContent ?? ""), {}, {timeout:180000});
  const editorCanvas = page.locator(".bof-panes-canvas");
  const editorBounds = await editorCanvas.boundingBox();
  assert.ok(editorBounds.height > 500, "The model uses the available pane height.");
  assert.ok(await page.locator(".bof-panes-legend span").count() > 0);
  for (const [x,y] of [[.5,.65],[.5,.5],[.5,.75],[.65,.7]]) {
    await page.mouse.click(editorBounds.x+editorBounds.width*x,editorBounds.y+editorBounds.height*y);
    if (/Selected entity/.test(await page.locator(".bof-panes-viewstatus").innerText())) break;
  }
  assert.match(await page.locator(".bof-panes-viewstatus").innerText(),/Selected entity/);
  assert.ok(await editorCanvas.isVisible(), "Picking an object keeps the graph node and pane open.");
  await page.screenshot({path:resolve(output,"editor-cutaway.png")});
  evidence.scenarios.push("Nine-node graph evaluates on host","Editor applies host recipe","Object picking preserves node focus");
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,"evidence.json"),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
} finally { await browser.close(); }
