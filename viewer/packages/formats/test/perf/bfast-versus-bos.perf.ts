/**
 * BFAST against BOS on the columnar path, on a real model.
 *
 * The decision to make BFAST the default (2026-09-07) was measured on the alpha path, which built
 * viewer-core groups and then one binding object per instance. This measures what V2 actually does:
 * parse, then fill the mesh list and the four instance columns, with no grouping step at all.
 *
 * Private data is never committed. When the models are absent the test prints why and passes.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { parseBfastModel } from '@ara3d/viewer-loaders';
import { describe, expect, it } from 'vitest';
import {
  bfastEntityRows,
  bfastInstances,
  bfastMeshes,
  defaultModelRef,
  readEntityFacts,
  readBfastModel,
} from '../../src/bfast.js';
import { defaultBosConverter, readBosModel } from '../../src/bos.js';
import { modelStatistics, validateLoadedModel } from '../../src/loaded-model.js';
import { once, repeat, report, reportValues, writeReport, type Measurement } from './measure.js';

const bfastPath =
  process.env['SNOWDON_BFAST_PATH'] ??
  'C:/Users/cdigg/git/bim-open-toolkit/viewer/packages/visualization/artifacts/bfast/snowdon-bim.bfast';
const bosPath =
  process.env['SNOWDON_BOS_PATH'] ?? 'C:/Users/cdigg/Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos';

const repetitions = 5;
const conversionRepetitions = 3;
const timeout = 600_000;

const readBuffer = (path: string): ArrayBuffer => {
  const bytes = readFileSync(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

const skipUnless = (path: string, what: string): boolean => {
  if (existsSync(path)) return false;
  console.log(`\nSkipped: no ${what} at ${path}. Set SNOWDON_BFAST_PATH or SNOWDON_BOS_PATH to measure.`);
  return true;
};

describe('BFAST versus BOS on the columnar path', () => {
  it(
    'measures the prepared BFAST path step by step',
    async () => {
      if (skipUnless(bfastPath, 'prepared BFAST model')) return;
      const buffer = readBuffer(bfastPath);
      const measurements: Measurement[] = [];

      const parsed = await repeat('parse container and render tables', repetitions, () => parseBfastModel(buffer));
      measurements.push(parsed.measurement);

      const facts = await repeat('decode entity ids, names and categories', repetitions, () =>
        readEntityFacts(parsed.last.bimData, 'full', {}),
      );
      measurements.push(facts.measurement);

      const identity = await repeat('decode entity ids only', repetitions, () =>
        readEntityFacts(parsed.last.bimData, 'identity', {}),
      );
      measurements.push(identity.measurement);

      const rows = await repeat('object rows from the entity table and placements', repetitions, () =>
        bfastEntityRows(parsed.last, facts.last.declared),
      );
      measurements.push(rows.measurement);

      const meshes = await repeat('mesh list as views on the file', repetitions, () => bfastMeshes(parsed.last));
      measurements.push(meshes.measurement);

      const columns = await repeat('instance columns', repetitions, () =>
        bfastInstances(parsed.last, meshes.last, rows.last, {}),
      );
      measurements.push(columns.measurement);

      const whole = await repeat('whole load, metadata full', repetitions, () =>
        readBfastModel(buffer, { ref: defaultModelRef('snowdon') }),
      );
      measurements.push(whole.measurement);

      const geometryOnly = await repeat('whole load, metadata none', repetitions, () =>
        readBfastModel(buffer, { ref: defaultModelRef('snowdon'), metadata: 'none' }),
      );
      measurements.push(geometryOnly.measurement);

      const validation = await once('validateLoadedModel over the whole model', () =>
        validateLoadedModel(whole.last),
      );
      measurements.push(validation.measurement);

      writeReport('measurements-bfast.md', [
        `# BFAST on the columnar path

Node ${process.version}, ${process.platform}. Warm up then ${repetitions} repetitions.
`,
        report('Steps of one load', measurements),
        reportValues('The model', {
          'file bytes': statSync(bfastPath).size,
          ...modelStatistics(whole.last),
          'objects with a name': whole.last.data.objects.filter((each) => each.name !== undefined).length,
          'objects with a category': whole.last.data.objects.filter((each) => each.category !== undefined).length,
          diagnostics: whole.last.diagnostics.map((each) => each.code).join(', '),
        }),
      ]);

      expect(validation.value).toEqual([]);
      expect(whole.last.geometry.instances.count).toBeGreaterThan(0);
      // Reading the prepared geometry costs less than decoding the property tables beside it.
      expect(parsed.measurement.median).toBeLessThan(facts.measurement.median);
      // The columnar build is a bulk pass, so it stays below the whole load it is part of.
      expect(columns.measurement.median).toBeLessThan(whole.measurement.median);
    },
    timeout,
  );

  it(
    'measures the BOS path, which prepares the archive as BFAST first',
    async () => {
      if (skipUnless(bfastPath, 'prepared BFAST model') || skipUnless(bosPath, 'BOS archive')) return;
      const bfastBuffer = readBuffer(bfastPath);
      const bosBuffer = readBuffer(bosPath);
      const measurements: Measurement[] = [];

      const conversion = await repeat('prepare the BOS archive as BFAST', conversionRepetitions, () =>
        defaultBosConverter(bosBuffer),
      );
      measurements.push(conversion.measurement);

      const throughBfast = await repeat('BFAST, whole load', repetitions, () =>
        readBfastModel(bfastBuffer, { ref: defaultModelRef('snowdon') }),
      );
      measurements.push(throughBfast.measurement);

      const throughBos = await repeat('BOS, whole load including preparation', conversionRepetitions, () =>
        readBosModel(bosBuffer, { ref: defaultModelRef('snowdon') }),
      );
      measurements.push(throughBos.measurement);

      writeReport('measurements-bfast-versus-bos.md', [
        `# BFAST against BOS, whole load

Node ${process.version}, ${process.platform}. Warm up then ${repetitions} repetitions, ${conversionRepetitions} for the steps that prepare the archive.
`,
        report('Whole load', measurements),
        reportValues('Sizes and counts', {
        'BOS bytes': statSync(bosPath).size,
        'prepared BFAST bytes': conversion.last.byteLength,
        'BFAST on disk bytes': statSync(bfastPath).size,
        'BFAST objects': throughBfast.last.data.objects.length,
        'BOS objects': throughBos.last.data.objects.length,
        'BFAST instances': throughBfast.last.geometry.instances.count,
        'BOS instances': throughBos.last.geometry.instances.count,
        }),
      ]);

      // The two paths meet at the same prepared bytes, so they describe the same model.
      expect(throughBos.last.data.objects.length).toBe(throughBfast.last.data.objects.length);
      expect(throughBos.last.geometry.instances.count).toBe(throughBfast.last.geometry.instances.count);
      expect(throughBos.last.geometry.meshes.length).toBe(throughBfast.last.geometry.meshes.length);
      // Reading a prepared file is faster than preparing one and then reading it.
      expect(throughBfast.measurement.median).toBeLessThan(throughBos.measurement.median);
      // The prepared file is larger than the archive it came from; transfer is a separate concern.
      expect(conversion.last.byteLength).toBeGreaterThan(bosBuffer.byteLength);
    },
    timeout,
  );
});
