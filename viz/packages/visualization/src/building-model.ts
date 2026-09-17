import { objectKey, type Diagnostic, type ObjectRef, type Result } from './contracts.js';

export type MissingReason = 'NotObserved' | 'NotExported' | 'NotApplicable' | 'Invalid' | 'Conflicting';
export type NumericFact = { readonly state: 'known'; readonly value: number; readonly unit: 'm'; readonly assurance: string; readonly evidenceIds: readonly string[] }
  | { readonly state: 'missing'; readonly reason: MissingReason; readonly explanation: string; readonly unit: 'm'; readonly evidenceIds: readonly string[] };
export type DoorScheduleRow = { readonly id: string; readonly name: string; readonly ref?: ObjectRef; readonly nominalWidth: NumericFact; readonly clearWidth: NumericFact; readonly evidenceIds: readonly string[] };
export type WidthCoverage = { total: number; known: number; missing: number; conflicting: number; invalid: number; inapplicable: number };
export type WorkflowEvidence = {
  readonly id: string; readonly origin: string; readonly method: string; readonly explanation: string; readonly sourceIds: readonly string[];
  readonly externalReferences: readonly { readonly authority: string; readonly title: string; readonly version: string; readonly locator: string }[];
};
export type DoorSchedule = {
  readonly snapshotId: string; readonly sourceFingerprint: string; readonly rows: readonly DoorScheduleRow[];
  readonly coverage: { readonly nominalWidth: WidthCoverage; readonly clearWidth: WidthCoverage }; readonly evidence: readonly WorkflowEvidence[];
};
export type DoorScheduleOptions = { readonly modelId: string; readonly contentFingerprint: string; readonly availableObjects?: Iterable<ObjectRef> };
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('Expected projection data object');
  return value as RecordValue;
};
const string = (value: unknown): string => { if (typeof value !== 'string') throw new Error('Expected projection string'); return value; };
const array = (value: unknown): unknown[] => { if (!Array.isArray(value)) throw new Error('Expected projection array'); return value; };
const strings = (value: unknown): string[] => Array.from(array(value), string);
const table = (value: unknown): Map<string, RecordValue> => {
  const result = new Map<string, RecordValue>();
  for (const item of array(value)) { const row = record(item), id = string(row.Id); if (!id || result.has(id)) throw new Error('Missing or duplicate projection table ID'); result.set(id, row); }
  return result;
};
const fingerprint = (value: unknown): string => {
  const text = string(value);
  if (!/^sha256:[a-f0-9]{64}$/i.test(text)) throw new Error('A SHA256 source fingerprint is required');
  return text.toLowerCase();
};
function width(value: unknown): NumericFact {
  if (value === undefined) return { state: 'missing', reason: 'NotObserved', explanation: 'Field absent from supplied projection', unit: 'm', evidenceIds: [] };
  const fact = record(value), evidenceIds = strings(fact.evidence);
  if (fact.state === 'known') {
    const metres = record(fact.value).Metres, assurance = string(fact.assurance);
    if (typeof metres !== 'number' || !Number.isFinite(metres) || metres < 0 || !['Observed', 'Derived', 'Estimated', 'Verified'].includes(assurance)) throw new Error('Invalid known width fact');
    return { state: 'known', value: metres, unit: 'm', assurance, evidenceIds };
  }
  const reason = string(fact.reason);
  if (fact.state !== 'missing' || !['NotObserved', 'NotExported', 'NotApplicable', 'Invalid', 'Conflicting'].includes(reason)) throw new Error('Invalid missing width fact');
  return { state: 'missing', reason: reason as MissingReason, explanation: string(fact.explanation), unit: 'm', evidenceIds };
}
function coverage(facts: readonly NumericFact[]): WidthCoverage {
  const result = { total: facts.length, known: 0, missing: 0, conflicting: 0, invalid: 0, inapplicable: 0 };
  for (const fact of facts) {
    if (fact.state === 'known') result.known++;
    else if (fact.reason === 'Conflicting') result.conflicting++;
    else if (fact.reason === 'Invalid') result.invalid++;
    else if (fact.reason === 'NotApplicable') result.inapplicable++;
    else result.missing++;
  }
  return result;
}

/** Consume only the architectural fields needed for a door schedule. No geometry/BIM inference or I/O. */
export function adaptDoorSchedule(projection: unknown, options: DoorScheduleOptions): Result<DoorSchedule> {
  try {
    const envelope = record(projection);
    if (envelope.Format !== 'ara3d.building-workflow-projection' || envelope.Version !== 1) throw new Error('Unsupported BuildingModel projection format/version');
    const model = record(envelope.Model), snapshotId = string(record(model.Snapshot).Id);
    if (!snapshotId || !options.modelId) throw new Error('Snapshot and model IDs are required');
    const expected = fingerprint(options.contentFingerprint), revisions = table(model.SourceRevisions);
    if (!revisions.size || [...revisions.values()].some(revision => fingerprint(revision.ContentFingerprint) !== expected)) return { ok: false, diagnostics: [{ code: 'source-mismatch', message: 'Workflow projection source fingerprint does not match the loaded geometry' }] };
    const objects = table(model.Objects), sources = table(model.SourceObjects), evidence = table(model.Evidence);
    const available = options.availableObjects ? new Set(Array.from(options.availableObjects, objectKey)) : undefined;
    const diagnostics: Diagnostic[] = [], referencedEvidence = new Set<string>(), ids = new Set<string>();
    const rows = array(model.Doors).map(value => {
      const door = record(value), id = record(door.Id), element = record(door.Element), objectId = string(element.ObjectId);
      if (id.snapshot !== snapshotId || id.local !== objectId || !objectId || ids.has(objectId)) throw new Error('Invalid or duplicate door snapshot identity');
      ids.add(objectId);
      const nominalWidth = width(door.NominalWidth), clearWidth = width(door.ClearWidth);
      const evidenceIds = [...new Set([...strings(element.Evidence), ...nominalWidth.evidenceIds, ...clearWidth.evidenceIds])];
      for (const id of evidenceIds) referencedEvidence.add(id);
      const semantic = objects.get(objectId);
      const locators = semantic ? strings(semantic.SourceIdentities).map(id => sources.get(id)) : [];
      const locator = locators.length === 1 ? locators[0] : undefined;
      let ref: ObjectRef | undefined;
      if (!locator || locator.Table !== 'Entities' || !Number.isSafeInteger(locator.Row) || (locator.Row as number) < 0 || !revisions.has(string(locator.SourceRevisionId))) {
        diagnostics.push({ code: 'unresolved-door-identity', message: `Door ${objectId}: one exact source entity row is required` });
      } else {
        const candidate = { modelId: options.modelId, objectId: `bos:${locator.Row}` };
        if (available && !available.has(objectKey(candidate))) diagnostics.push({ code: 'unavailable-door-object', message: `Door ${objectId}: source row is absent from the loaded model`, ref: candidate });
        else ref = candidate;
      }
      return { id: objectId, name: element.Name === null || element.Name === undefined ? objectId : string(element.Name), nominalWidth, clearWidth, evidenceIds, ...(ref ? { ref } : {}) };
    });
    const retainedEvidence: WorkflowEvidence[] = [];
    for (const id of referencedEvidence) {
      const item = evidence.get(id);
      if (!item) { diagnostics.push({ code: 'missing-workflow-evidence', message: `Referenced evidence ${id} is unavailable` }); continue; }
      const externalReferences = array(item.ExternalReferences ?? []).map(value => {
        const link = record(value);
        return { authority: string(link.Authority), title: string(link.Title), version: string(link.Version), locator: string(link.Locator) };
      });
      retainedEvidence.push({ id, origin: string(item.Origin), method: string(item.Method), explanation: string(item.Explanation), sourceIds: strings(item.Sources), externalReferences });
    }
    return { ok: true, value: { snapshotId, sourceFingerprint: expected, rows, coverage: { nominalWidth: coverage(rows.map(row => row.nominalWidth)), clearWidth: coverage(rows.map(row => row.clearWidth)) }, evidence: retainedEvidence }, diagnostics };
  } catch (error) { return { ok: false, diagnostics: [{ code: 'invalid-workflow-projection', message: error instanceof Error ? error.message : String(error) }] }; }
}
