import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, totalmem, release } from 'node:os';
const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL??'msedge',headless:true});
const output = new URL('../artifacts/frame-benchmark/', import.meta.url);
try {
  const page = await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  // Keep a running measurement independent of development-server hot reloads.
  await page.route('**/frame-benchmark-host',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Snowdon frame benchmark</title>'}));
  const errors=[];
  page.on('pageerror',error=>{errors.push(String(error));console.error(error);});
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(`${process.env.DEMO_URL??'http://127.0.0.1:5173'}/frame-benchmark-host`);
  const metadata = await page.evaluate(async()=>{window.benchmark=await (await import('/frame-benchmark.ts')).prepare();return window.benchmark.metadata;});
  const report={metadata:{...metadata,browser:browser.version(),cpu:cpus()[0].model,ram:totalmem(),os:release(),protocol:'5 warmup + 40 measured frames; quarter-quadrant orbit; RAF intervals are not GPU/display latency; no software GPU flags'},results:[]};
  console.log(JSON.stringify(report.metadata));
  await mkdir(output,{recursive:true});
  const variants=process.argv.slice(2).filter(v=>!['--verify','--updates'].includes(v));
  for (const variant of variants.length?variants:['sorted','opaque-unsorted','unculled','unculled-unsorted','half-resolution','unlit','no-sync','sorted']) {
    const result=await page.evaluate(v=>window.benchmark.measure(v),variant);
    report.results.push(result); console.log(JSON.stringify({variant,metrics:result.metrics}));
    await writeFile(new URL(`${process.env.BENCHMARK_NAME??'results'}.json`,output),JSON.stringify(report,null,2));
  }
  if(process.argv.includes('--verify')){
    report.verification=await page.evaluate(()=>window.benchmark.verify());
    for(const check of report.verification){
      for(const [name,data] of Object.entries(check.images??{}))await writeFile(new URL(`${check.name}-${name}.png`,output),Buffer.from(data.split(',')[1],'base64'));
      delete check.images;
    }
    console.log(JSON.stringify({verification:report.verification}));
  }
  if(process.argv.includes('--updates')){
    report.updates=[];
    for(const operation of ['color','visibility','transform','ghost']){
      const result=await page.evaluate(op=>window.benchmark.measureUpdates(op),operation);
      report.updates.push(result);console.log(JSON.stringify({operation,metrics:result.metrics}));
      await writeFile(new URL(`${process.env.BENCHMARK_NAME??'results'}.json`,output),JSON.stringify(report,null,2));
    }
  }
  await mkdir(output,{recursive:true});
  await page.screenshot({path:new URL('scene.png',output).pathname.replace(/^\/(.:)/,'$1')});
  await writeFile(new URL(`${process.env.BENCHMARK_NAME??'results'}.json`,output),JSON.stringify(report,null,2));
  await page.evaluate(()=>window.benchmark.dispose());
  if(errors.length)throw Error(errors.join('\n'));
  if(report.verification?.some(check=>!check.passed))throw Error('Rendered pixel verification failed');
} finally {await browser.close();}
