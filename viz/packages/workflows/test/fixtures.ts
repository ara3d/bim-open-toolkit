import { readFileSync } from 'node:fs';
import {
  formatPath,
  object,
  parse,
  record,
  string,
  unknownValue,
  type Result,
  type Schema,
} from '@bim-open-toolkit/model';

// One hand-written expected-result file: the inputs a workflow is given and what it must produce.
// The files were written from the product brief before any adapter existed; they are the acceptance
// tests, not a record of what the code happens to do.
export type Fixture = {
  readonly workflow: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly expected: Readonly<Record<string, unknown>>;
  readonly notes: string;
};

const fixtureSchema: Schema<Fixture> = object({
  workflow: string(),
  inputs: record(unknownValue()),
  expected: record(unknownValue()),
  notes: string(),
});

const explain = (label: string, result: Result<unknown>): string =>
  `${label}: ${result.diagnostics.map((item) => `${formatPath(item.path)} ${item.message}`).join('; ')}`;

// The named fixture under `test/expected`.
export const loadFixture = (name: string): Fixture => {
  const parsed: unknown = JSON.parse(readFileSync(new URL(`./expected/${name}.json`, import.meta.url), 'utf8'));
  const checked = parse(fixtureSchema, parsed);
  if (!checked.ok) throw new Error(explain(name, checked));
  return checked.value;
};

// The fixture's input tables read through the workflow's own input schema, with the parameters the
// fixture states in prose rather than in JSON (the model revision, and which facts are reviewed).
export const fixtureInput = <T>(
  schema: Schema<T>,
  fixture: Fixture,
  parameters: Readonly<Record<string, unknown>> = {},
): T => {
  const checked = parse(schema, { ...fixture.inputs, ...parameters });
  if (!checked.ok) throw new Error(explain(`${fixture.workflow} input`, checked));
  return checked.value;
};

// The value of a successful result, or an error naming why the workflow refused its input.
export const valueOfResult = <T>(label: string, result: Result<T>): T => {
  if (!result.ok) throw new Error(explain(label, result));
  return result.value;
};

// The model revision the fixtures' bare object ids belong to. The fixtures carry ids alone; a
// result carries object keys, so the test states the revision the ids are read at.
export const fixtureModel = { id: 'fixture', revision: '1' } as const;

// The second revision the revision-comparison fixture reads its B-side ids at.
export const fixtureModelB = { id: 'fixture', revision: '2' } as const;
