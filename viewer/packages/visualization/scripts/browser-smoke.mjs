import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory=path.dirname(fileURLToPath(import.meta.url));
const output=path.resolve(directory,'../artifacts/browser-smoke');
const baseURL=process.env.DEMO_URL??'http://127.0.0.1:5173';
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL??'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
  const probe=await browser.newPage();
  const graphics=await probe.evaluate(()=>{
    const gl=document.createElement('canvas').getContext('webgl2');
    if(!gl)return null;
    const extension=gl.getExtension('WEBGL_debug_renderer_info');
    const renderer=extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):'unavailable';
    const version=gl.getParameter(gl.VERSION);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return {renderer,version};
  });
  assert.ok(graphics,'Isolated test browser cannot create WebGL2');
  console.log(JSON.stringify({browser:browser.version(),graphics,mode:'software WebGL; functional checks, not a hardware performance benchmark'}));
  await probe.close();
  if(!process.argv.includes('--probe')){
    await mkdir(output,{recursive:true});
    const modules=await Promise.all(['loading','spatial','review'].map(name=>import(`./browser-specs/${name}.mjs`)));
    const filter=process.env.BIM_BROWSER_CASE;
    const scenarios=modules.flatMap(module=>module.scenarios).filter(item=>!filter||item.name.includes(filter)||item.feature===filter);
    assert.ok(scenarios.length,'No matching browser scenarios');
    for(const scenario of scenarios){
      const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
      page.setDefaultTimeout(20000);
      const errors=[];
      page.on('pageerror',error=>errors.push(String(error)));
      page.on('console',message=>{if(message.type()==='error')errors.push(`${message.text()} @ ${message.location().url}`);});
      const started=performance.now();
      let result={name:scenario.name,feature:scenario.feature,model:scenario.model};
      try{
        await page.goto(`${baseURL}/?feature=${encodeURIComponent(scenario.feature)}&model=${scenario.model}`,{waitUntil:'domcontentloaded',timeout:30000});
        await page.waitForFunction(()=>/objects|FAILED|LOST/.test(document.querySelector('#model-count')?.textContent??''),{},{timeout:120000});
        assert.match(await page.locator('#model-count').innerText(),/objects/,'Model did not become ready');
        if(scenario.model==='snowdon')assert.match(await page.locator('#model-count').innerText(),/51,139 objects/);
        await scenario.run(page);
        assert.deepEqual(errors,[],'Browser emitted errors');
        await page.screenshot({path:path.join(output,`${scenario.feature}.png`)});
        result={...result,passed:true,elapsedMs:Math.round(performance.now()-started)};
      }catch(error){
        result={...result,passed:false,error:String(error),browserErrors:errors,elapsedMs:Math.round(performance.now()-started)};
        await page.screenshot({path:path.join(output,`${scenario.feature}-failed.png`)}).catch(()=>{});
      }finally{await page.close();}
      results.push(result);console.log(JSON.stringify(result));
      const reportName=filter?`results-${filter.replace(/[^a-z0-9_-]/gi,'-')}.json`:'results.json';
      await writeFile(path.join(output,reportName),JSON.stringify({baseURL,graphics,results},null,2));
    }
    if(results.some(item=>!item.passed))process.exitCode=1;
  }
}finally{await browser.close();}
