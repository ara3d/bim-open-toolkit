import assert from 'node:assert/strict';

export const scenarios = [
  {
    name: 'Door exceptions retain evidence through selection restore', feature: 'doors', model: 'snowdon',
    async run(page) {
      const panel = page.locator('#feature-controls');
      await panel.getByText(/142\/142 doors/).waitFor();
      await page.getByRole('button', { name: 'Select nominal-width exceptions', exact: true }).click();
      const evidence = panel.locator('pre');
      await evidence.filter({ hasText: 'Conflicting' }).waitFor();
      const original = await evidence.textContent();
      assert.match(original, /Snapshot:/);
      assert.match(original, /Clear width: NotObserved/);
      await page.getByRole('button', { name: 'Save selected door refs', exact: true }).click();
      const saved = page.getByRole('textbox', { name: 'Saved door selection JSON' });
      await page.waitForFunction(() => document.querySelector('textarea')?.value.length > 0);
      const document = JSON.parse(await saved.inputValue());
      assert.equal(document.sets[0].members.length, 1);
      assert.match(document.models[0].revision, /^sha256:/);
      await panel.locator('button[aria-pressed="false"]').first().click();
      assert.notEqual(await evidence.textContent(), original);
      await page.getByRole('button', { name: 'Restore selected door refs', exact: true }).click();
      await evidence.filter({ hasText: 'Conflicting' }).waitFor();
      assert.equal(await evidence.textContent(), original);
    },
  },
  {
    name: 'React review links actual facts, selection and filtering', feature: 'react-review', model: 'snowdon',
    async run(page) {
      const app = page.getByRole('region', { name: 'React BuildingModel review' });
      await app.getByText(/0 selected · 142\/142 doors/).waitFor();
      assert.match(await app.textContent(), /141 known \/ 1 conflicting/);
      const rows = app.getByRole('group', { name: 'Door schedule' }).getByRole('button');
      assert.equal(await rows.count(), 142);
      await rows.first().click();
      await app.getByText(/1 selected · 142\/142 doors/).waitFor();
      await app.getByText('Selected door evidence', { exact: true }).waitFor();
      assert.match(await app.locator('details').textContent(), /Snapshot.*Object/s);
      await app.getByLabel('Filter doors').fill('no-door-matches-this-filter');
      await app.getByText(/1 selected · 0\/142 doors/).waitFor();
      assert.equal(await rows.count(), 0);
      await app.getByLabel('Filter doors').fill('');
      await app.getByText(/1 selected · 142\/142 doors/).waitFor();
    },
  },
  {
    name: 'Snowdon capture produces a decoded PNG thumbnail', feature: 'capture', model: 'snowdon',
    async run(page) {
      await page.getByRole('button', { name: 'Capture PNG', exact: true }).click();
      const thumbnail = page.getByRole('img', { name: 'Latest viewer capture' });
      await thumbnail.waitFor({ state: 'visible' });
      assert.match(await thumbnail.getAttribute('src'), /^blob:/);
      await thumbnail.evaluate(image => image.decode());
      assert.ok(await thumbnail.evaluate(image => image.naturalWidth > 0 && image.naturalHeight > 0));
      assert.equal(await page.getByRole('button', { name: 'Download latest PNG' }).isEnabled(), true);
    },
  },
  {
    name: 'Local view save, reload and delete use one private name', feature: 'storage', model: 'small',
    async run(page) {
      const name = `browser-review-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const input = page.getByRole('textbox', { name: 'Saved scene name' });
      const status = page.locator('.viewport-note');
      await input.fill(name);
      try {
        await page.getByRole('button', { name: 'Save as new', exact: true }).click();
        await status.filter({ hasText: `Saved ${name} in this browser.` }).waitFor();
        assert.equal(await page.getByRole('option', { name, exact: true }).count(), 1);
        await page.getByRole('button', { name: 'Reload named save', exact: true }).click();
        await status.filter({ hasText: `Restored ${name} against the loaded source revision.` }).waitFor();
      } finally {
        await input.fill(name);
        await page.getByRole('button', { name: 'Delete named save', exact: true }).click();
        await status.filter({ hasText: `Deleted ${name}.` }).waitFor();
        assert.equal(await page.getByRole('option', { name, exact: true }).count(), 0);
      }
    },
  },
];
