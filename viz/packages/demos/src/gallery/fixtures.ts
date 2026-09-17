// The fixture picker: which data a demo is showing, and what else it will accept.
//
// A fixture is not built until it is chosen - `DemoFixture.source` is a function - so listing a
// demo's fixtures costs nothing, which is why the index page can show them for every demo at once.

import { routeHref, withFixture, type Route } from './routes.js';
import type { DataBasis, Demo, DemoFixture } from './contracts.js';

// One entry in the picker: what it is, where choosing it goes, and whether it is the current one.
export type FixtureChoice = {
  readonly id: string;
  readonly title: string;
  readonly basis: DataBasis;
  readonly href: string;
  readonly current: boolean;
};

// What a data basis is called in the chrome. Every demo says which of the three it is, so nobody
// has to guess whether a number was generated or read from a file.
export const basisLabel = (basis: DataBasis): string =>
  basis === 'synthetic' ? 'Generated' : basis === 'source-backed' ? 'From a source file' : 'Generated and source data';

// The fixture the route names, or the demo's default when it names none or names one this demo
// does not have.
export const chosenFixture = (demo: Demo, fixtureId: string | undefined): DemoFixture | undefined =>
  (fixtureId === undefined ? undefined : demo.fixtures.find((one) => one.id === fixtureId)) ?? demo.fixtures[0];

// Every fixture of a demo as a choice, with the one in force marked.
export const fixtureChoices = (demo: Demo, route: Route): readonly FixtureChoice[] => {
  const current = chosenFixture(demo, route.fixtureId);
  return demo.fixtures.map((one) => ({
    id: one.id,
    title: one.title,
    basis: one.basis,
    href: routeHref(withFixture({ ...route, demoId: demo.id }, one.id)),
    current: one.id === current?.id,
  }));
};
