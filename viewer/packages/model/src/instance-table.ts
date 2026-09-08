import { colorStride, transformStride, type InstanceRecords } from './mesh.js';
import { table, type Column, type Table } from './table.js';

// Column names of the transform components, `m{c * 4 + r}` for element (row r, column c) of the
// column-major transform, so `m12`, `m13` and `m14` are the translation.
export const transformColumnNames: readonly string[] =
  Array.from({ length: transformStride }, (_unused, index) => `m${index}`);

// Column names of the colour components, in the order the colour buffer stores them.
export const colorColumnNames: readonly string[] = ['red', 'green', 'blue', 'alpha'];

// Rows transposed per pass. A strided read touches one cache line per element, so one whole-buffer
// pass per component reads the buffer once per component; a block of rows is instead read once and
// spread into every component column while it is still in cache.
const blockRows = 512;

// Each component of a strided float buffer as its own array: one allocation per component for the
// whole table, no allocation and no function call per row. A strided view of a typed array does not
// exist in JavaScript, so component columns are copies while `meshIndex` and `objectIndex` are not.
const spreadComponents = (values: Float32Array, stride: number, count: number): readonly Float32Array[] => {
  const targets = Array.from({ length: stride }, () => new Float32Array(count));
  for (let start = 0; start < count; start += blockRows) {
    const end = Math.min(start + blockRows, count);
    for (let offset = 0; offset < stride; offset += 1) {
      const target = targets[offset] ?? new Float32Array(0);
      for (let row = start; row < end; row += 1) target[row] = values[row * stride + offset] ?? 0;
    }
  }
  return targets;
};

// The named columns of one strided buffer.
const componentColumns = (
  names: readonly string[],
  values: Float32Array,
  stride: number,
  count: number,
): readonly (readonly [string, Column])[] => {
  const components = spreadComponents(values, stride, count);
  return names.map(
    (name, offset) => [name, { type: 'f32', values: components[offset] ?? new Float32Array(0) }] as const,
  );
};

// The records' optional columns, present only when the records carry them, sharing their arrays.
const optionalColumns = (records: InstanceRecords): readonly (readonly [string, Column])[] => [
  ...(records.visible === undefined ? [] : [['visible', { type: 'bool', values: records.visible }] as const]),
  ...(records.roughness === undefined ? [] : [['roughness', { type: 'f32', values: records.roughness }] as const]),
  ...(records.metallic === undefined ? [] : [['metallic', { type: 'f32', values: records.metallic }] as const]),
];

// Instance records as a table, one row per instance. `meshIndex` and `objectIndex` are the records'
// own arrays, not copies; each transform and colour component is its own column, so filtering,
// sorting, taking and joining rows keep every column of a row together. Building the table costs
// one pass and one allocation per component column, never one per row. An optional records column
// becomes a table column only when the records carry it, so absent stays absent.
export const instanceTable = (records: InstanceRecords): Table =>
  table([
    ['meshIndex', { type: 'i32', values: records.meshIndex }],
    ['objectIndex', { type: 'i32', values: records.objectIndex }],
    ...componentColumns(transformColumnNames, records.transform, transformStride, records.count),
    ...componentColumns(colorColumnNames, records.color, colorStride, records.count),
    ...optionalColumns(records),
  ]);
