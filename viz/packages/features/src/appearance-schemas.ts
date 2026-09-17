// The plain-data schemas the appearance, sets, edits and replacement features share.
//
// Everything here is JSON a saved document can hold, so a state slice, a command input and a
// generated tool descriptor all describe the same shapes and none of them is hand-written twice.

import {
  array,
  boolean,
  number,
  object,
  optional,
  record,
  refine,
  string,
  tuple,
  union,
  type Appearance,
  type AppearanceChange,
  type AppearanceExtras,
  type Color,
  type Matrix4,
  type ObjectKey,
  type Schema,
  type StyleRule,
} from '@bim-open-toolkit/model';

// A number that is neither NaN nor an infinity, which is what JSON and a typed array both hold.
export const finiteNumber = (): Schema<number> =>
  refine(number(), (value) => Number.isFinite(value), 'schema/finite', 'Expected a finite number.');

// A number from 0 to 1, which is what a colour channel and an opacity are.
export const unitNumber = (): Schema<number> =>
  refine(finiteNumber(), (value) => value >= 0 && value <= 1, 'schema/unit', 'Expected a number from 0 to 1.');

// An object key, as `objectKey` percent-encodes one.
export const objectKeySchema: Schema<ObjectKey> = string();

// The objects a rule, a set or an edit names.
export const objectKeysSchema: Schema<readonly ObjectKey[]> = array(objectKeySchema);

// Red, green and blue, each from 0 to 1.
export const colorSchema: Schema<Color> = tuple(unitNumber(), unitNumber(), unitNumber());

// A column-major 4x4 transform as sixteen finite numbers, element (row r, column c) at c * 4 + r.
export const matrix4Schema: Schema<Matrix4> = tuple(
  finiteNumber(), finiteNumber(), finiteNumber(), finiteNumber(),
  finiteNumber(), finiteNumber(), finiteNumber(), finiteNumber(),
  finiteNumber(), finiteNumber(), finiteNumber(), finiteNumber(),
  finiteNumber(), finiteNumber(), finiteNumber(), finiteNumber(),
);

// Named plain values a feature adds to an appearance without changing the model package.
export const extrasSchema: Schema<AppearanceExtras> = record(
  union<string | number | boolean>(string(), number(), boolean()),
);

// A change to an appearance: an absent property is left as it was.
export const appearanceChangeSchema: Schema<AppearanceChange> = object({
  color: optional(colorSchema),
  opacity: optional(unitNumber()),
  visible: optional(boolean()),
  extras: optional(extrasSchema),
});

// A whole appearance, which is what a base map and a legend swatch carry.
export const appearanceSchema: Schema<Appearance> = object({
  color: colorSchema,
  opacity: unitNumber(),
  visible: boolean(),
  extras: optional(extrasSchema),
});

// A style rule: a change applied to the objects it names, at a priority, switchable on its own.
export const styleRuleSchema: Schema<StyleRule> = object({
  id: string(),
  name: string(),
  enabled: boolean(),
  priority: finiteNumber(),
  targets: objectKeysSchema,
  change: appearanceChangeSchema,
});

// The input of a command that takes nothing, which still validates that it was given an object.
export const noInput = object({});
