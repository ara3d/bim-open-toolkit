import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "../viewer/node_modules/playwright-core/index.mjs";

// Run against an isolated BIM-profile host: edits are restored in finally.
const base = process.env.BOF_DEMO_URL;
assert.ok(base,"Set BOF_DEMO_URL to an isolated BIM demo host; this test edits and restores its graph.");
const endpoint = base + "/api/analyses/snowdon-toolkit";
const original = await (await fetch(endpoint)).text();
JSON.parse(original);
const output = resolve("artifacts/bim-flow/graph-browser");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({channel:"msedge",headless:true,args:["--enable-unsafe-swiftshader"]});
const errors = [];
const scenarios = [];
const measurements = {};
const saves = [];
let page;
try {
  page = await browser.newPage({viewport:{width:1680,height:1050}});
  page.on("pageerror", e => errors.push(e.message));
  let modelRequests = 0;
  page.on("request", r => { if (/\/api\/models\/.*\/bos/.test(r.url())) modelRequests++; });
  page.on("request", r => {
    if(r.url()===endpoint && r.method()==="PUT") saves.push({event:"request",at:Date.now(),
      values:Object.fromEntries(Object.entries(r.postDataJSON().values).filter(([id])=>id!=="snowdon"))});
  });
  page.on("response", r => {
    if(r.url()===endpoint && r.request().method()==="PUT") saves.push({event:"response",at:Date.now(),status:r.status()});
  });
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
  await page.getByLabel("Preview node").selectOption("cutaway");
  await page.waitForTimeout(400);
  await frame();
  const before = await hash();
  const input = page.getByLabel("cutaway fraction",{exact:true});
  assert.equal(await input.getAttribute("max"), "100");
  assert.equal(await input.getAttribute("min"), "0");
  await input.fill("25");
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
  const partRect = (id, name, option) => page.evaluate(({id,name,option}) => {
    const runtime = window.gratify;
    const walk = n => [n,...n.children.flatMap(walk)];
    const node = walk(runtime.root).find(n => n.key === id && n.part.name === "bof-node");
    const part = option !== undefined
      ? walk(runtime.adornRoot).find(n => n.part.name === "bof-slot-option" && n.el.props.text === option)
      : name === "bof-node" ? node : walk(node).find(n => n.part.name === name);
    if (!part) throw new Error(`Missing ${id} / ${name}`);
    const {pan,zoom} = runtime.viewport, r = part.rect;
    const canvas = document.querySelector(".bof-app-canvas-host canvas").getBoundingClientRect();
    return {x:canvas.x+pan.x+r.x*zoom,y:canvas.y+pan.y+r.y*zoom,w:r.w*zoom,h:r.h*zoom,zoom};
  },{id,name,option});
  const select = async nodeId => {
    await page.getByLabel("Preview node").selectOption(nodeId);
    await page.waitForTimeout(350);
    await frame();
  };
  const pickEnum = async (nodeId, value) => {
    const field = await partRect(nodeId,"bof-slot-enum");
    await page.mouse.click(field.x+field.w*.75,field.y+field.h/2);
    await page.waitForTimeout(250);
    const option = await partRect(nodeId,"bof-slot-option",value);
    await page.mouse.click(option.x+option.w/2,option.y+option.h/2);
  };
  const parity = async nodeId => {
    const expected = await page.evaluate(async nodeId => {
      const {buildLiveViewRecipe} = await import("/src/liveViewRecipe.ts");
      const {nodes} = await (await fetch("/api/catalog/nodes")).json();
      const model = window.gratify.doc;
      const graph = { formatVersion:"0.1.0", layout:{},
        structure:{ nodes:model.nodes.map(n=>({id:n.id,kind:n.kind,version:1})), edges:model.edges.map(e=>({from:e.from,to:e.to})) },
        values:Object.fromEntries(model.nodes.map(n=>[n.id,Object.fromEntries(n.params.map(p=>[p.name,p.value]))])),
      };
      const recipe = buildLiveViewRecipe(graph,nodeId,new Map(nodes.map(n=>[n.kind,n])));
      if(recipe.kind!=="ready") throw new Error(JSON.stringify(recipe));
      return recipe.data.rows.map(([operation,input])=>({operation,input:JSON.parse(input)}));
    },nodeId);
    await page.waitForFunction(async ({url,expected}) => {
      const response = await fetch(url);
      if (!response.ok) return false;
      const result = await response.json();
      return JSON.stringify(result.rows.map(([operation,input])=>({operation,input:JSON.parse(input)})))===JSON.stringify(expected);
    },{url:endpoint+`/results/${nodeId}/view`,expected},{timeout:10000});
    return expected;
  };
  const change = async (gesture, verify) => {
    const before = await hash();
    const saved = page.waitForResponse(r => r.url() === endpoint && r.request().method() === "PUT" && r.ok());
    await gesture();
    await saved;
    // A drag may start several autosaves; the first response can contain an intermediate value.
    const deadline = Date.now()+15000;
    while (true) {
      try { verify(await (await fetch(endpoint)).json()); break; }
      catch (error) {
        if (Date.now()>deadline) throw error;
        await page.waitForTimeout(150);
      }
    }
    await frame();
    assert.notEqual(await hash(),before,"A control gesture changes rendered pixels");
  };
  await select("categories");
  const swatches = () => page.locator(".bof-panes-legend i").evaluateAll(items=>items.map(item=>getComputedStyle(item).backgroundColor));
  const classicPixels = await hash();
  const classicSwatches = await swatches();
  assert.ok(classicSwatches.length>1,"Category legend contains source category colors");
  await change(()=>pickEnum("categories","pastel"),g=>assert.equal(g.values.categories.palette,"pastel"));
  const pastelRecipe = await parity("categories");
  assert.equal(pastelRecipe[1].input.palette,"pastel");
  assert.notEqual(await hash(),classicPixels,"Palette dropdown changes actual model colors");
  assert.notDeepEqual(await swatches(),classicSwatches,"Palette dropdown updates category legend swatches");
  await page.screenshot({path:resolve(output,"pastel-palette.png")});
  await change(()=>pickEnum("categories","classic"),g=>assert.equal(g.values.categories.palette,"classic"));
  assert.equal((await parity("categories"))[1].input.palette,"classic");
  assert.equal(await hash(),classicPixels,"Returning to classic restores the model colors exactly");
  assert.deepEqual(await swatches(),classicSwatches,"Returning to classic restores the category legend");
  scenarios.push("Palette dropdown updates saved graph, live and server recipes, model colors and legend swatches");
  const opaqueCategories = await hash();
  await select("ghost");
  assert.notEqual(await hash(),opaqueCategories,"Ghost node makes its model transparent");
  await select("categories");
  assert.equal(await hash(),opaqueCategories,"Switching from ghost to category node fully restores opacity");
  const categoryRecipe = await parity("categories");
  assert.deepEqual(categoryRecipe.map(step=>step.operation),["scene","categoryStyle"]);
  assert.equal(categoryRecipe[1].input.opacity,1);
  scenarios.push("Selecting categories after ghost restores an opaque model and uses only its connected recipe");
  await select("cutaway");
  const slider = await partRect("cutaway","slider");
  assert.equal(slider.zoom,1,"Editing opens at readable 100% scale");
  await change(async () => {
    await page.mouse.move(slider.x+slider.w*.25,slider.y+slider.h/2);
    await page.mouse.down();
    await page.mouse.move(slider.x+slider.w*.7,slider.y+slider.h/2,{steps:5});
    await page.mouse.up();
  },g => assert.ok(Number(g.values.cutaway.fraction)>.6));
  scenarios.push("Gratify slider updates graph, recipe and rendered cutaway at readable scale");
  await change(()=>pickEnum("cutaway","x"),g=>assert.equal(g.values.cutaway.axis,"x"));
  scenarios.push("Gratify dropdown changes section axis");
  await change(async () => {
    await input.fill("150");
    await input.press("Enter");
  },g=>assert.equal(g.values.cutaway.fraction,"1"));
  await input.press("ArrowUp");
  await input.press("Enter");
  assert.equal(await input.inputValue(),"100","Native spinner cannot increase beyond 100 percent");
  await change(async () => {
    await input.fill("-25");
    await input.press("Enter");
  },g=>assert.equal(g.values.cutaway.fraction,"0"));
  await input.press("ArrowDown");
  await input.press("Enter");
  assert.equal(await input.inputValue(),"0","Native spinner cannot decrease below zero percent");
  await parity("cutaway");
  scenarios.push("Percent display converts to Fraction and number/spinner controls constrain both bounds");
  await select("tint");
  await change(async () => {
    await page.getByLabel("tint color",{exact:true}).fill("#e63620");
  },g => assert.equal(g.values.tint.color,"#e63620"));
  scenarios.push("Color picker updates model tint");
  await parity("tint");
  await select("exploded");
  const explode = await partRect("exploded","slider");
  const serverBefore = await (await fetch(endpoint)).json();
  const explodeBefore = await hash();
  let releaseSave;
  let intercepted = false;
  const held = new Promise(resolve=>{releaseSave=resolve;});
  const blockSave = async route => {
    if(route.request().method()!=="PUT") return route.continue();
    intercepted=true;
    await held;
    await route.continue();
  };
  await page.route(endpoint,blockSave);
  try {
    await page.mouse.move(explode.x+explode.w*.1,explode.y+explode.h/2);
    await page.mouse.down();
    const started = performance.now();
    await page.mouse.move(explode.x+explode.w*.65,explode.y+explode.h/2,{steps:3});
    await frame();
    assert.notEqual(await hash(),explodeBefore,"Explode changes pixels during a held drag before any backend save");
    measurements.explodeGestureToScreenshotMs = Math.round(performance.now()-started);
    await page.mouse.up();
    await page.waitForTimeout(600);
    assert.ok(intercepted,"Autosave request was held before reaching the host");
    assert.equal((await (await fetch(endpoint)).json()).values.exploded.strength,serverBefore.values.exploded.strength,
      "Host graph is unchanged while local explode geometry updates");
    const local = await page.evaluate(()=>window.gratify.doc.nodes.find(n=>n.id==="exploded").params.find(p=>p.name==="strength").value);
    assert.ok(Number(local)>2,"Actual slider gesture updated the graph parameter");
    const saved=page.waitForResponse(r=>r.url()===endpoint&&r.request().method()==="PUT"&&r.ok());
    releaseSave();
    await saved;
    await parity("exploded");
    scenarios.push("Explode updates during slider drag with autosave blocked; server recipe matches after release");
    await page.screenshot({path:resolve(output,"live-explode.png")});
  } finally {
    releaseSave();
    await page.unroute(endpoint,blockSave);
  }
  await select("categories");
  assert.equal(await hash(),opaqueCategories,"Leaving exploded branch restores original category geometry");
  scenarios.push("Selecting a different branch clears the previous explosion");
  await select("band");
  const range = await partRect("band","range");
  await change(async () => {
    const x = range.x+10+(range.w-20)*.3;
    await page.mouse.move(x,range.y+range.h/2);
    await page.mouse.down();
    await page.mouse.move(range.x+10+(range.w-20)*.5,range.y+range.h/2,{steps:5});
    await page.mouse.up();
  },g => assert.ok(JSON.parse(g.values.band.range)[0]>.4));
  scenarios.push("Gratify dual-handle range changes section band");
  await page.screenshot({path:resolve(output,"range-controls.png")});
  // Rewire the actual graph with a socket drag, not a direct viewer command.
  await page.getByRole("button",{name:"Fit graph",exact:true}).click();
  await frame();
  const tint = await partRect("tint","bof-node"), band = await partRect("band","bof-node");
  await change(async () => {
    await page.mouse.move(tint.x+tint.w,tint.y+58*tint.zoom);
    await page.mouse.down();
    await page.mouse.move(band.x,band.y+58*band.zoom,{steps:10});
    await page.mouse.up();
  },g => assert.ok(g.structure.edges.some(e=>e.from==="tint.view"&&e.to==="band.view")));
  const bandResult = await (await fetch(endpoint+"/results/band/view")).json();
  assert.deepEqual(bandResult.rows.map(r=>r[0]),["scene","tint","sectionRange"]);
  scenarios.push("Socket rewiring changes evaluated recipe order and rendered model");
  await parity("band");
  scenarios.push("Local preview and evaluated recipes match exactly for section, tint, explode and rewired range");
  const deleteTarget = await partRect("band","bof-node");
  await page.mouse.click(deleteTarget.x+deleteTarget.w/2,deleteTarget.y+18*deleteTarget.zoom,{button:"right"});
  const deleted = page.waitForResponse(r=>r.url()===endpoint&&r.request().method()==="PUT"&&r.ok());
  await page.getByRole("menuitem",{name:"Delete node",exact:true}).click();
  await deleted;
  assert.ok(!(await (await fetch(endpoint)).json()).structure.nodes.some(n=>n.id==="band"),"Right-click Delete removes the actual graph node");
  const undone = page.waitForResponse(r=>r.url()===endpoint&&r.request().method()==="PUT"&&r.ok());
  await graph.focus();
  await page.keyboard.press("Control+z");
  await undone;
  assert.ok((await (await fetch(endpoint)).json()).structure.nodes.some(n=>n.id==="band"),"Undo restores the deleted node");
  await select("band");
  await parity("band");
  scenarios.push("Right-click Delete edits the graph and Ctrl+Z restores the node and its connected recipe");
  await page.mouse.click(left.x+15,left.y+left.height-15);
  assert.ok(await view.isVisible(),"Clearing graph selection preserves the preview");
  await page.getByRole("button",{name:"Nodes",exact:true}).click();
  assert.ok(await page.locator(".bof-app-sidebar").isVisible());
  await page.getByRole("button",{name:"Nodes",exact:true}).click();
  await page.getByRole("button",{name:"Fit graph",exact:true}).click();
  scenarios.push("Canvas deselection preserves preview","Catalog opens and closes","Graph fit works");
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,"evidence.json"),JSON.stringify({browser:browser.version(),scenarios,measurements,saves},null,2));
  console.log(JSON.stringify({scenarios,measurements},null,2));
} catch (error) {
  await page?.screenshot({path:resolve(output,"failure.png")}).catch(()=>{});
  await writeFile(resolve(output,"failure.json"),JSON.stringify({scenarios,measurements,saves,errors,error:String(error)},null,2));
  throw error;
} finally {
  await browser.close();
  const restored = await fetch(endpoint,{method:"PUT",headers:{"Content-Type":"application/json"},body:original});
  assert.ok(restored.ok,"Restore original graph after verification");
}
