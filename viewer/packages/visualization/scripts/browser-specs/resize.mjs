import assert from 'node:assert/strict';

async function settle(page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
  });
}

export const scenarios = [
  {
    name:'ResizeObserver browser errors reach verification', feature:'selection', model:'small',
    async run(page) {
      const message = 'ResizeObserver loop completed with undelivered notifications.';
      // Induce one real browser delivery error, then stop the intentional loop.
      await page.evaluate(() => new Promise(resolve => {
        const element = document.createElement('div');
        element.style.width = '10px';
        document.body.append(element);
        const observer = new ResizeObserver(() => { element.style.width = `${element.clientWidth + 1}px`; });
        window.addEventListener('error', () => {
          observer.disconnect(); element.remove(); resolve();
        }, {once:true});
        observer.observe(element);
      }));
      assert.ok((await page.evaluate(() => window.__browserErrors)).includes(message));
      assert.match(await page.locator('.fatal-error').innerText(), /ResizeObserver loop/);
      // Reload clears only this scenario's deliberately induced error.
      await page.getByRole('link', {name:'Feature gallery'}).click();
      await page.locator('.cards').waitFor();
    },
  },
  ...['small', 'snowdon'].map(model => ({
    name: `Resize stability ${model}`, feature: 'comparison', model, deviceScaleFactor: 2,
    async run(page) {
      for (const viewport of [{width:1100,height:400}, {width:700,height:600}, {width:1280,height:800}]) {
        await page.setViewportSize(viewport);
        await settle(page);
        const sizes = await page.locator('.viewport').evaluate(element => {
          const canvas = element.querySelector('canvas');
          return {height:element.clientHeight, canvasHeight:canvas.clientHeight, buffer:canvas.height, screen:innerHeight};
        });
        assert.ok(sizes.height <= sizes.screen, `Viewport escaped its layout: ${JSON.stringify(sizes)}`);
        assert.equal(sizes.canvasHeight, sizes.height);
        assert.equal(sizes.buffer, sizes.canvasHeight * 2);
        assert.equal(await page.locator('.fatal-error').count(), 0);
      }
      await page.getByRole('button', {name:'Add second view',exact:true}).click();
      await settle(page);
      await page.setViewportSize({width:1000,height:500});
      await settle(page);
      await page.getByRole('button', {name:'Remove second view',exact:true}).click();
      await settle(page);
      assert.equal(await page.locator('.fatal-error').count(), 0);
    },
  })),
  {
    name:'Runtime error preserves gallery navigation', feature:'selection', model:'small',
    async run(page) {
      // Synthetic events exercise the visible error path without throwing an actual page exception.
      await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', {message:'Injected runtime failure'})));
      assert.match(await page.locator('.fatal-error').innerText(), /Injected runtime failure/);
      assert.deepEqual(await page.evaluate(() => window.__browserErrors), ['Injected runtime failure']);
      await page.setViewportSize({width:390,height:600});
      await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', {message:'Long failure '.repeat(200)})));
      const back = page.getByRole('link', {name:'Feature gallery'});
      const alertBox = await page.locator('.fatal-error').boundingBox();
      const backBox = await back.boundingBox();
      assert.ok(alertBox.y >= backBox.y + backBox.height);
      await back.click();
      await page.locator('.cards').waitFor();
    },
  },
];
