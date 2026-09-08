import { literal, union, type Schema } from '@bim-open-toolkit/model';

// A schema accepting exactly one of the given strings, which is what a closed vocabulary is.
export const enumeration = <T extends string>(values: readonly T[]): Schema<T> =>
  union<T>(...values.map((value) => literal(value)));
