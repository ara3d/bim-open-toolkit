import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adaptDoorSchedule } from '../src/building-model.js';

const hash = `sha256:${'a'.repeat(64)}`;
const missing = (reason = 'NotObserved') => ({ state: 'missing', reason, explanation: 'No measurement supplied', evidence: [] });
const fixture = () => ({ Format: 'ara3d.building-workflow-projection', Version: 1, Model: {
  Snapshot: { Id: 'snapshot' }, SourceRevisions: [{ Id: 'revision', ContentFingerprint: hash }],
  Objects: [{ Id: 'door', SourceIdentities: ['source'] }], SourceObjects: [{ Id: 'source', SourceRevisionId: 'revision', Table: 'Entities', Row: 12 }],
  Evidence: [{ Id: 'width-evidence', Origin: 'Source', Method: 'typed source measurement', Explanation: 'Measured nominal width; not a clear width', Sources: ['source'] }],
  Doors: [{ Id: { snapshot: 'snapshot', local: 'door' }, Element: { ObjectId: 'door', Name: 'Door A', Evidence: [] }, NominalWidth: { state: 'known', value: { Metres: 0.9 }, assurance: 'Observed', evidence: ['width-evidence'] }, ClearWidth: missing() }],
} });
const options = { modelId: 'snowdon', contentFingerprint: hash };

describe('BuildingModel door schedule adapter', () => {
  it('preserves typed width units, missing reasons, evidence and exact source row identity', () => {
    const result = adaptDoorSchedule(fixture(), options);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Adaptation failed');
    expect(result.diagnostics).toEqual([]);
    expect(result.value.rows[0]).toMatchObject({ id: 'door', ref: { modelId: 'snowdon', objectId: 'bos:12' }, nominalWidth: { state: 'known', value: 0.9, unit: 'm', evidenceIds: ['width-evidence'] }, clearWidth: { state: 'missing', reason: 'NotObserved' } });
    expect(result.value.evidence[0]).toMatchObject({ id: 'width-evidence', sourceIds: ['source'] });
    expect(result.value.coverage.nominalWidth.known).toBe(1);
    expect(result.value.coverage.clearWidth.missing).toBe(1);
    expect(result.value.rows[0]!.clearWidth).not.toHaveProperty('value');
  });
  it('rejects source mismatch before binding any row', () => {
    const result = adaptDoorSchedule(fixture(), { ...options, contentFingerprint: `sha256:${'b'.repeat(64)}` });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'source-mismatch' }] });
    expect(adaptDoorSchedule(fixture(), { ...options, contentFingerprint: hash.toUpperCase() }).ok).toBe(true);
  });
  it('keeps ambiguous or unavailable rows inspectable without guessed selection references', () => {
    const projection = fixture(); projection.Model.Objects[0]!.SourceIdentities.push('second-source');
    const ambiguous = adaptDoorSchedule(projection, options);
    expect(ambiguous).toMatchObject({ ok: true, diagnostics: [{ code: 'unresolved-door-identity' }] });
    if (ambiguous.ok) expect(ambiguous.value.rows[0]).not.toHaveProperty('ref');
    const unavailable = adaptDoorSchedule(fixture(), { ...options, availableObjects: [] });
    expect(unavailable).toMatchObject({ ok: true, diagnostics: [{ code: 'unavailable-door-object' }] });
    const geometryFree = adaptDoorSchedule(fixture(), { ...options, availableObjects: [{ modelId: 'snowdon', objectId: 'bos:12' }] });
    expect(geometryFree.diagnostics).toEqual([]);
  });
  it('reports unavailable evidence while retaining its identity', () => {
    const projection = fixture(); projection.Model.Evidence = [];
    const result = adaptDoorSchedule(projection, options);
    expect(result).toMatchObject({ ok: true, diagnostics: [{ code: 'missing-workflow-evidence' }] });
    if (result.ok) expect(result.value.rows[0]!.nominalWidth.evidenceIds).toEqual(['width-evidence']);
  });
  it.each(['NotObserved', 'NotExported', 'NotApplicable', 'Invalid', 'Conflicting'])('preserves unavailable reason %s without zero substitution', reason => {
    const projection = fixture(); projection.Model.Doors[0]!.ClearWidth = missing(reason);
    const result = adaptDoorSchedule(projection, options);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.rows[0]!.clearWidth).toEqual({ state: 'missing', reason, explanation: 'No measurement supplied', evidenceIds: [], unit: 'm' });
  });
  it('represents absent width fields as unavailable, not nominal-width fallbacks', () => {
    const projection = fixture(); delete (projection.Model.Doors[0] as Partial<typeof projection.Model.Doors[number]>).ClearWidth;
    const result = adaptDoorSchedule(projection, options);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.rows[0]!.clearWidth).toMatchObject({ state: 'missing', reason: 'NotObserved', explanation: 'Field absent from supplied projection' });
  });
  it('retains versioned external evidence links as data', () => {
    const projection = fixture();
    Object.assign(projection.Model.Evidence[0]!, { ExternalReferences: [{ Authority: 'Host', Title: 'Door drawing', Version: 'R1', Locator: 'host://drawing/12' }] });
    const result = adaptDoorSchedule(projection, options);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.evidence[0]!.externalReferences).toEqual([{ authority: 'Host', title: 'Door drawing', version: 'R1', locator: 'host://drawing/12' }]);
  });
  it('rejects malformed schema, inconsistent snapshots and invalid numeric observations', () => {
    expect(adaptDoorSchedule({}, options).ok).toBe(false);
    expect(adaptDoorSchedule({ ...fixture(), Version: 2 }, options).ok).toBe(false);
    const snapshot = fixture(); snapshot.Model.Doors[0]!.Id.snapshot = 'different';
    expect(adaptDoorSchedule(snapshot, options).ok).toBe(false);
    const invalid = fixture(); invalid.Model.Doors[0]!.NominalWidth.value.Metres = NaN;
    expect(adaptDoorSchedule(invalid, options).ok).toBe(false);
  });
});

const localProjection = new URL('../../../../artifacts/building-model-workflows/snowdon/projection.json', import.meta.url);
it.skipIf(!existsSync(localProjection))('adapts the private actual Snowdon projection with 142 mapped doors', () => {
  const projection = JSON.parse(readFileSync(localProjection, 'utf8'));
  const result = adaptDoorSchedule(projection, { modelId: 'snowdon', contentFingerprint: 'sha256:FC31C4463D9EB958AE8DE3D853CFC8224B9469477B419857FBC929956C9CC51D' });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  expect(result.value.rows).toHaveLength(142);
  expect(result.value.rows.every(row => row.ref?.objectId.startsWith('bos:'))).toBe(true);
  expect(result.value.coverage.nominalWidth).toMatchObject({ total: 142, known: 141, conflicting: 1 });
  expect(result.value.coverage.clearWidth).toMatchObject({ total: 142, known: 0, missing: 142 });
  expect(result.diagnostics).toEqual([]);
});
