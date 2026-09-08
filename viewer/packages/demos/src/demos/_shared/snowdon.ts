// The real model every demo opens by default: Snowdon Towers, read from its BFAST file.
//
// It is a real building - a hundred megabytes of it - and it is private, so it is never committed
// and never bundled. The gallery's dev server hands it out from wherever it sits on the machine
// (`vite.gallery.config.mjs`, `/fixtures/`), which is why this is a URL and not an import: a demo
// names a model, and the machine says where its models are.
//
// Every demo lists the generated building after it. That fixture is not a fallback that hides a
// missing file - a missing file is reported as one - it is the second entry in the picker, there
// because a generated model has deliberate gaps and conflicts a real one does not, and some demos
// exist to show exactly those.

import { success, type Result } from '@bim-open-toolkit/model';
import { defaultBuildingOptions, generateBuilding, type BuildingOptions } from '@bim-open-toolkit/synthetic';
import type { DemoFixture, ModelSource } from '../../gallery/contracts.js';

// The file the dev server looks for. `snowdon.bfast` is the geometry-and-parameters export;
// `snowdon-bim.bfast` is the larger one with the full BIM tables.
export const snowdonFile = 'snowdon.bfast';

// Where the dev server publishes it. Relative, so the gallery works on whatever port it is on.
export const snowdonUrl = `/fixtures/${snowdonFile}`;

// Snowdon Towers, as a demo fixture. Source-backed: every number in it came out of the file.
export const snowdon: DemoFixture = {
  id: 'snowdon',
  title: 'Snowdon Towers',
  basis: 'source-backed',
  source: (): Promise<Result<ModelSource>> =>
    Promise.resolve(success({ kind: 'url', id: 'snowdon', url: snowdonUrl })),
};

// The generated building, for the demos that want deliberate gaps and conflicts to point at.
export const syntheticBuilding = (options: BuildingOptions = defaultBuildingOptions): DemoFixture => ({
  id: 'building',
  title: 'Synthetic building',
  basis: 'synthetic',
  source: (): Promise<Result<ModelSource>> => {
    const built = generateBuilding(options);
    return Promise.resolve(success({ kind: 'data', id: 'building', data: built.model, geometry: built.geometry }));
  },
});

// What a demo lists when it wants the real model first and the generated one behind it.
export const snowdonThenSynthetic: readonly DemoFixture[] = [snowdon, syntheticBuilding()];
