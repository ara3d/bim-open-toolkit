import assert from 'node:assert/strict';

const button = (page, name) => page.getByRole('button', { name, exact: true });
async function status(page, text) {
  const note = page.locator('.viewport-note').filter({ hasText: text });
  await note.waitFor({ state: 'visible' });
  assert.match(await note.innerText(), text);
}

export const scenarios = [
  {
    name: 'Orthographic top view restores perspective', feature: 'projection', model: 'small',
    async run(page) {
      await button(page, 'Top').click();
      await status(page, /top orthographic view/);
      await button(page, 'Zoom in').click();
      await button(page, 'Return to perspective').click();
      await status(page, /Perspective orbit restored/);
      await button(page, 'Reset feature').click();
      assert.equal(await button(page, 'Top').count(), 1);
      await button(page, 'Top').click();
      await status(page, /top orthographic view/);
      await button(page, 'Return to perspective').click();
      await status(page, /Perspective orbit restored/);
    },
  },
  {
    name: 'Snowdon axis clipping clears and resets', feature: 'clipping', model: 'snowdon',
    async run(page) {
      await page.getByRole('combobox', { name: 'Section axis', exact: true }).selectOption('X');
      await status(page, /Keeping X ≥/);
      await button(page, 'Apply axis section').click();
      await status(page, /Keeping X ≥/);
      await button(page, 'Clear clipping').click();
      await status(page, /Clipping cleared/);
      await button(page, 'Reset feature').click();
      await status(page, /Choose an axis section/);
      assert.equal(await page.getByRole('combobox', { name: 'Section axis', exact: true }).inputValue(), 'Y');
      assert.equal(await button(page, 'Apply axis section').count(), 1);
    },
  },
  {
    name: 'Comparison second view links and releases', feature: 'comparison', model: 'small',
    async run(page) {
      const second = page.locator('canvas[aria-label="Second comparison viewer"]');
      await button(page, 'Add second view').click();
      await status(page, /Two views share the model data/);
      assert.equal(await second.count(), 1);
      await button(page, 'Link cameras').click();
      await status(page, /linked in both directions/);
      assert.equal(await button(page, 'Unlink cameras').getAttribute('aria-pressed'), 'true');
      await button(page, 'Remove second view').click();
      await status(page, /Second view removed/);
      assert.equal(await second.count(), 0);
      assert.equal(await button(page, 'Add second view').isEnabled(), true);
      assert.equal(await button(page, 'Link cameras').isDisabled(), true);
      await button(page, 'Add second view').click();
      await status(page, /Two views share the model data/);
      await button(page, 'Remove second view').click();
      await status(page, /Second view removed/);
      assert.equal(await second.count(), 0);
    },
  },
  {
    name: 'Snowdon default first object replacement undoes', feature: 'replacement', model: 'snowdon',
    async run(page) {
      // The feature explicitly chooses the first rendered object when selection is empty.
      await button(page, 'Replace selected with box').click();
      await status(page, /Replacement retains the source object identity/);
      await page.locator('#feature-controls p').filter({ hasText: /CPU replacement submission/ }).waitFor();
      await button(page, 'Undo selected replacement').click();
      await status(page, /Original geometry restored/);
      await button(page, 'Undo selected replacement').click();
      await status(page, /Selected object has no replacement/);
    },
  },
];
