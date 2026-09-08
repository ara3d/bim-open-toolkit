/// <reference types="vite/client" />
// Finding the demos. A demo is a directory under `src/demos` exporting `demo` from its `index.ts`,
// so adding one touches no central file and removing one leaves nothing behind.
//
// The glob is eager on purpose: the index page lists every demo's title, question and labels, so it
// needs all of them anyway, and a lazy glob would make the first paint wait on a network round trip
// per demo in development.

import { duplicateDemoIds, type Demo, type DemoModule } from './contracts.js';
import { demo as placeholder } from '../demos/_shared/placeholder.js';

// What discovery came to: the demos in a stable order, the ids claimed twice, and whether the only
// thing found was the placeholder.
export type Discovery = {
  readonly demos: readonly Demo[];
  // Ids exported by more than one module. The gallery shows these rather than picking a winner.
  readonly duplicates: readonly string[];
  readonly usingPlaceholder: boolean;
};

// Whether a module really exports a demo. A directory can hold anything, so this is checked rather
// than assumed; a module that is not one is skipped and named.
const isDemoModule = (value: unknown): value is DemoModule => {
  if (typeof value !== 'object' || value === null || !('demo' in value)) return false;
  const found: unknown = value.demo;
  return typeof found === 'object' && found !== null && 'id' in found && typeof found.id === 'string';
};

// The demos of a set of modules, in the order of their paths, with the placeholder standing in only
// when nothing else was found.
export const discoverDemos = (modules: Readonly<Record<string, unknown>>): Discovery => {
  const found = Object.keys(modules)
    .sort()
    .flatMap((path) => {
      const held = modules[path];
      return isDemoModule(held) ? [held.demo] : [];
    });
  return found.length === 0
    ? { demos: [placeholder], duplicates: [], usingPlaceholder: true }
    : { demos: found, duplicates: duplicateDemoIds(found), usingPlaceholder: false };
};

// The demo whose id matches, or the first one when nothing matches or nothing was asked for.
export const demoById = (demos: readonly Demo[], id: string | null): Demo | undefined =>
  (id === null ? undefined : demos.find((one) => one.id === id)) ?? demos[0];

// Every demo in this build.
export const discoveredDemos = (): Discovery =>
  discoverDemos(import.meta.glob('../demos/*/index.ts', { eager: true }));
