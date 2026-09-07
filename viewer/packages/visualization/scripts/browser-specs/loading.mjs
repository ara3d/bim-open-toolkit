import assert from 'node:assert/strict';

const button = (page, name) => page.getByRole('button', { name, exact: true });
const status = async (page, text) => {
  await page.locator('.viewport-note').filter({ hasText: text }).waitFor();
  assert.match(await page.locator('.viewport-note').innerText(), text);
};

export const scenarios = [
  {
    name: 'Loading faults reject without replacing the small model',
    feature: 'loading-checks', model: 'small',
    async run(page) {
      const baseline = await page.locator('#model-count').innerText();
      for (const [label, expected] of [
        ['Check HTML response', /PASS — HTML response: load-failed/],
        ['Check truncated ZIP', /PASS — truncated ZIP: load-failed/],
        ['Check pre-aborted load', /PASS — pre-aborted load: aborted/],
      ]) {
        await button(page, label).click();
        const result = page.locator('#feature-controls [role="status"]').filter({ hasText: expected });
        await result.waitFor();
        assert.match(await result.innerText(), /Original scene group count unchanged/);
        assert.equal(await page.locator('#feature-controls [role="alert"]').count(), 0);
        assert.equal(await page.locator('#model-count').innerText(), baseline);
      }
    },
  },
  {
    name: 'Snowdon categories, ghosting and appearance reset',
    feature: 'appearance', model: 'snowdon',
    async run(page) {
      await button(page, 'Synthetic categories').click();
      await status(page, /Synthetic index % 3: 0 blue/);
      await button(page, 'Ghost objects').click();
      await status(page, /opacity 18%/);
      await button(page, 'Make opaque').waitFor();
      await button(page, 'Reset appearance demo').click();
      await status(page, /Original source colors/);
      assert.doesNotMatch(await page.locator('.viewport-note').innerText(), /opacity 18%/);
      await button(page, 'Ghost objects').waitFor();
    },
  },
  {
    name: 'Gratify HTML equivalents dispatch and restore ghosting',
    feature: 'gratify', model: 'small',
    async run(page) {
      await page.getByLabel('Gratify review controls; equivalent buttons follow', { exact: true }).waitFor();
      const ghost = button(page, 'Toggle ghosting (HTML)');
      assert.equal(await ghost.getAttribute('aria-pressed'), 'false');
      await ghost.click();
      await status(page, /Model ghosted to 20% opacity/);
      assert.equal(await ghost.getAttribute('aria-pressed'), 'true');
      await ghost.click();
      await status(page, /Source opacity restored/);
      assert.equal(await ghost.getAttribute('aria-pressed'), 'false');
      await button(page, 'Clear selection (HTML)').click();
      await status(page, /Selection cleared/);
      await button(page, 'Fit model (HTML)').click();
    },
  },
  {
    name: 'Snowdon selected-object move transaction and undo',
    feature: 'edits', model: 'snowdon',
    async run(page) {
      const undo = button(page, 'Undo');
      assert.equal(await undo.isDisabled(), true);
      await button(page, 'Select first rendered object').click();
      await status(page, /1 selected · 0 transactions/);
      await button(page, 'Move selected +X').click();
      await status(page, /1 selected · 1 transactions/);
      assert.equal(await undo.isEnabled(), true);
      await undo.click();
      await status(page, /1 selected · 0 transactions/);
      assert.equal(await undo.isDisabled(), true);
      assert.equal(await button(page, 'Redo').isEnabled(), true);
    },
  },
];
