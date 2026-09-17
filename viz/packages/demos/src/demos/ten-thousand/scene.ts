// The stress scenes this demo offers, and the one that is open.
//
// Generating 100,000 instances is not free, so a scene is built once per instance count and kept.
// The generator is deterministic, so the kept scene and a fresh one are the same scene; the cache is
// there to save the work, not to hold a secret.
//
// `openedScene` is what the fixture last opened. A style rule names the objects it colours one by
// one, so the recolour button needs the keys of what is actually on the screen, and nothing in the
// `Demo` contract passes the opened model from `source` to `start`. This is the same held value the
// workflow demos keep, and it is why it lives in its own module with the reason written down.

import { objectKey, type ObjectKey } from '@bim-open-toolkit/model';
import { defaultStressOptions, generateStressScene, type StressScene } from '@bim-open-toolkit/synthetic';

// How many instances each choice draws, in the order the gallery lists them.
export const stressCounts = { 'ten-thousand': 10_000, 'two-thousand': 2000, 'hundred-thousand': 100_000 } as const;

export type StressChoice = keyof typeof stressCounts;

// The choices, default first. Two thousand is what the browser smoke can draw in software.
export const stressChoices: readonly StressChoice[] = ['ten-thousand', 'two-thousand', 'hundred-thousand'];

// What each choice is called.
export const stressTitles: Readonly<Record<StressChoice, string>> = {
  'ten-thousand': '10,000 instances',
  'two-thousand': '2,000 instances',
  'hundred-thousand': '100,000 instances',
};

const built = new Map<StressChoice, StressScene>();

// The scene for a choice, generated once. A hundred thousand instances need a wider triangle budget
// than the default ten thousand, which is stated here rather than discovered as a thrown error.
export const stressScene = (choice: StressChoice): StressScene => {
  const held = built.get(choice);
  if (held !== undefined) return held;
  const instances = stressCounts[choice];
  const scene = generateStressScene({
    ...defaultStressOptions,
    instances,
    triangleBudget: Math.max(defaultStressOptions.triangleBudget, instances * 100),
  });
  built.set(choice, scene);
  return scene;
};

let opened: StressChoice | undefined;

// Records which scene a fixture opened, and returns it.
export const openStressScene = (choice: StressChoice): StressScene => {
  opened = choice;
  return stressScene(choice);
};

// The choice that is open, or undefined before a fixture has been opened.
export const openedChoice = (): StressChoice | undefined => opened;

// Every object of the open scene, which is what a style rule has to name one by one.
export const openedKeys = (): readonly ObjectKey[] => {
  const choice = opened;
  if (choice === undefined) return [];
  return stressScene(choice).model.objects.map((record) => objectKey(record.ref));
};

// Forgets which scene is open, so a disposed demo leaves nothing behind.
export const forgetOpenedScene = (): void => {
  opened = undefined;
};
