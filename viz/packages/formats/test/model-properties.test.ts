/**
 * The property and document decoding as the BFAST reader wires it up.
 *
 * Two halves. The first runs on the in-memory fixtures, which carry no BOS tables at all, and checks
 * that asking for properties a file does not have is a diagnostic rather than a failure. The second
 * needs the private federated model, which is a hundred megabytes that is never committed, so it
 * skips itself by name when the file is not on this machine.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readBfastModel } from '../src/bfast.js';
import { formatCode } from '../src/diagnostics.js';
import { validateLoadedModel } from '../src/loaded-model.js';
import { documentOfObject, findProperty, objectProperties, propertyCount } from '../src/properties.js';
import { asBuffer, bfastModel, triangleMesh } from './fixtures.js';

describe('a BFAST carrying no BOS tables', () => {
  const bare = () => asBuffer(bfastModel({ meshes: [triangleMesh()], instances: [{ mesh: 0, entity: 0 }] }));

  it('reads without properties or documents when none are asked for', async () => {
    const model = await readBfastModel(bare());
    expect(model.properties).toBeUndefined();
    expect(model.documents).toBeUndefined();
    expect(model.data.objects).toHaveLength(1);
  });

  it('reports the missing tables and still loads when properties are asked for', async () => {
    const model = await readBfastModel(bare(), { properties: true });
    expect(model.properties).toBeUndefined();
    expect(model.diagnostics.map((each) => each.code)).toContain(formatCode.missingPropertyTables);
    expect(model.diagnostics.every((each) => each.severity !== 'error')).toBe(true);
    expect(model.geometry.instances.count).toBe(1);
  });

  it('says nothing about documents when the metadata level never asked for the entity table', async () => {
    const model = await readBfastModel(bare(), { metadata: 'identity' });
    expect(model.documents).toBeUndefined();
    expect(model.diagnostics.map((each) => each.code)).not.toContain(formatCode.missingDocumentTable);
  });
});

// The private federated Revit export. Never committed, so every check below is skipped without it.
const realModel = fileURLToPath(new URL('../../visualization/artifacts/bfast/snowdon-bim.bfast', import.meta.url));

describe.skipIf(!existsSync(realModel))(
  'the Snowdon federated model (skipped: the private snowdon-bim.bfast is not on this machine)',
  () => {
    const loaded = async (properties: boolean) => {
      const bytes = readFileSync(realModel);
      return readBfastModel(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), {
        ...(properties ? { properties: true } : {}),
      });
    };

    it('attributes every object to one of the seven source documents, without asking for properties', async () => {
      const model = await loaded(false);
      const documents = model.documents;
      expect(documents).toBeDefined();
      if (documents === undefined) return;
      expect(documents.count).toBe(7);
      expect(documents.title).toContain('Snowdon Towers Sample Architectural');
      expect(model.properties).toBeUndefined();
      const attributed = model.data.objects.filter((_, row) => documentOfObject(documents, row) >= 0);
      expect(attributed).toHaveLength(model.data.objects.length);
    }, 120_000);

    it('decodes every parameter row, and reads a floor area in the unit the file recorded', async () => {
      const model = await loaded(true);
      const properties = model.properties;
      expect(properties).toBeDefined();
      if (properties === undefined) return;
      expect(properties.rows).toBe(1_620_524);
      expect(properties.dropped).toBe(0);
      expect(properties.objects).toBe(model.data.objects.length);
      expect(properties.descriptors.count).toBe(2545);

      const areas = model.data.objects
        .map((_, row) => findProperty(properties, row, 'Area'))
        .filter((each) => each !== undefined);
      expect(areas.length).toBeGreaterThan(20_000);
      for (const area of areas.slice(0, 100)) {
        expect(area?.units).toBe('SQUARE_FEET');
        expect(typeof area?.value).toBe('number');
      }
      expect(validateLoadedModel(model)).toEqual([]);
    }, 120_000);

    it('gives every object a property sheet', async () => {
      const model = await loaded(true);
      const properties = model.properties;
      if (properties === undefined) throw new Error('the model decoded no properties');
      const empty = model.data.objects.filter((_, row) => propertyCount(properties, row) === 0);
      expect(empty).toHaveLength(0);
      const sheet = objectProperties(properties, 1165);
      expect(sheet.length).toBeGreaterThan(0);
      expect(sheet.some((each) => each.name !== undefined)).toBe(true);
    }, 120_000);
  },
);
