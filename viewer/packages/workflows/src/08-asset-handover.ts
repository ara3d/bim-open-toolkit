import {
  array,
  failure,
  missing,
  modelRefSchema,
  object,
  resultOf,
  string,
  type Diagnostic,
  type ModelRef,
  type Observation,
  type Result,
  type Schema,
} from '@bim-open-toolkit/model';
import { workflowException, type WorkflowException } from './exception.js';
import {
  duplicateDiagnostics,
  keyOf,
  keysOf,
  namedObjectSet,
  suggestedView,
  unknownReferenceDiagnostic,
} from './keys.js';
import { observationJsonSchema, toObservation, type ObservationJson } from './observation.js';
import { marker, onObject } from './overlay.js';
import { groupByOutcome, outcomeRules, worseOutcome, type Outcome } from './outcome.js';
import { enumeration } from './schema-tools.js';
import { workflowResult, type WorkflowResult } from './result.js';
import { resultRecord, resultTable, type ResultRow } from './values.js';
import { workflow, type Workflow } from './workflow.js';

// Whether service history was ever tracked for an asset, independent of whether any events exist.
export type ServiceHistoryTracking = 'recorded' | 'not-recorded';

// One equipment asset.
export type HandoverAsset = {
  readonly objectId: string;
  readonly name: string;
  readonly category: string;
  readonly installDate: ObservationJson;
};

// One recorded maintenance event. `date` is always known: a recorded event has a date by
// construction, so it is a plain string rather than an observation.
export type MaintenanceEvent = { readonly id: string; readonly assetId: string; readonly date: string; readonly note: string };

// Whether an asset's service history was ever tracked, kept separate from the event count itself so
// a genuinely empty tracked history can be told apart from a history that was never tracked at all.
export type ServiceHistoryStatus = { readonly assetId: string; readonly status: ServiceHistoryTracking };

// The assets, their maintenance events and their service-history tracking status.
export type AssetHandoverInput = {
  readonly model: ModelRef;
  readonly assets: readonly HandoverAsset[];
  readonly maintenanceEvents: readonly MaintenanceEvent[];
  readonly serviceHistoryStatus: readonly ServiceHistoryStatus[];
};

const serviceHistoryTrackingSchema: Schema<ServiceHistoryTracking> = enumeration(['recorded', 'not-recorded']);

// The JSON an asset handover run is given.
export const assetHandoverInputSchema: Schema<AssetHandoverInput> = object({
  model: modelRefSchema,
  assets: array(
    object({ objectId: string(), name: string(), category: string(), installDate: observationJsonSchema }),
  ),
  maintenanceEvents: array(object({ id: string(), assetId: string(), date: string(), note: string() })),
  serviceHistoryStatus: array(object({ assetId: string(), status: serviceHistoryTrackingSchema })),
});

const eventsOf = (assetId: string, events: readonly MaintenanceEvent[]): readonly MaintenanceEvent[] =>
  events.filter((event) => event.assetId === assetId);

// The latest of the asset's event dates, or `null` when it has none. ISO dates order lexically, so
// no parsing is needed to find the latest one.
const lastServiceDate = (events: readonly MaintenanceEvent[]): string | null =>
  events.length === 0 ? null : events.map((event) => event.date).reduce((latest, date) => (date > latest ? date : latest));

const handoverRow = (asset: HandoverAsset, events: readonly MaintenanceEvent[]): ResultRow =>
  resultRecord({
    objectId: asset.objectId,
    name: asset.name,
    eventCount: events.length,
    lastServiceDate: lastServiceDate(events),
  });

// The tracking status of an asset's service history: `not-recorded` when stated, and treated the
// same way when the table carries no row for the asset at all, since an unstated status is exactly
// the gap this table exists to disambiguate.
const trackingOf = (assetId: string, statuses: readonly ServiceHistoryStatus[]): ServiceHistoryTracking =>
  statuses.find((item) => item.assetId === assetId)?.status ?? 'not-recorded';

const outcomeOfObservation = (observation: Observation): Outcome =>
  observation.kind === 'known' ? 'resolved' : observation.kind === 'missing' ? 'missing' : 'conflicting';

const assetExceptions = (
  asset: HandoverAsset,
  statuses: readonly ServiceHistoryStatus[],
): readonly WorkflowException[] => {
  const installObservation = toObservation(asset.installDate);
  const tracking = trackingOf(asset.objectId, statuses);
  return [
    ...(installObservation.kind === 'known'
      ? []
      : [workflowException([asset.objectId], 'installDate', installObservation)]),
    ...(tracking === 'recorded'
      ? []
      : [
          workflowException([asset.objectId], 'serviceHistoryStatus', missing('not-provided'), {
            detail: 'service history was never tracked for this asset',
          }),
        ]),
  ];
};

const assetOutcome = (asset: HandoverAsset, statuses: readonly ServiceHistoryStatus[]): Outcome => {
  const installOutcome = outcomeOfObservation(toObservation(asset.installDate));
  const serviceOutcome: Outcome = trackingOf(asset.objectId, statuses) === 'recorded' ? 'resolved' : 'missing';
  return worseOutcome(installOutcome, serviceOutcome);
};

const referenceDiagnostics = (input: AssetHandoverInput): readonly Diagnostic[] => {
  const assetIds = new Set(input.assets.map((asset) => asset.objectId));
  return [
    ...input.maintenanceEvents.flatMap((event) =>
      assetIds.has(event.assetId) ? [] : [unknownReferenceDiagnostic('maintenanceEvents', 'assetId', event.assetId)],
    ),
    ...input.serviceHistoryStatus.flatMap((item) =>
      assetIds.has(item.assetId) ? [] : [unknownReferenceDiagnostic('serviceHistoryStatus', 'assetId', item.assetId)],
    ),
  ];
};

// Asset handover and maintenance: one row per asset regardless of its exceptions, with a missing or
// disputed install date and an untracked service history each reported on their own. A tracked
// history with zero events stays a plain zero; an untracked one is never read as if it were zero.
export const runAssetHandover = (input: AssetHandoverInput): Result<WorkflowResult> => {
  const duplicates = [
    ...duplicateDiagnostics('assets', input.assets.map((asset) => asset.objectId)),
    ...duplicateDiagnostics('maintenanceEvents', input.maintenanceEvents.map((event) => event.id)),
    ...duplicateDiagnostics('serviceHistoryStatus', input.serviceHistoryStatus.map((item) => item.assetId)),
  ];
  if (duplicates.length > 0) return failure(duplicates);

  const diagnostics = referenceDiagnostics(input);

  const rows = input.assets.map((asset) => handoverRow(asset, eventsOf(asset.objectId, input.maintenanceEvents)));
  const exceptions = input.assets.flatMap((asset) => assetExceptions(asset, input.serviceHistoryStatus));
  const exceptionIds = [...new Set(exceptions.flatMap((item) => item.subjects))];

  const rules = outcomeRules(
    'asset-handover',
    groupByOutcome(
      input.assets.map((asset): readonly [string, Outcome] => [
        keyOf(input.model, asset.objectId),
        assetOutcome(asset, input.serviceHistoryStatus),
      ]),
    ),
  );

  return resultOf(
    workflowResult({
      id: 'asset-handover',
      title: 'Asset handover and maintenance',
      model: input.model,
      tables: [resultTable('handover', 'Asset handover', rows)],
      summary: { assetCount: input.assets.length, exceptionCount: exceptions.length },
      exceptions,
      rules,
      sets: [
        namedObjectSet('asset-handover/assets', 'Handover assets', input.model, input.assets.map((asset) => asset.objectId)),
        namedObjectSet('asset-handover/exceptions', 'Assets needing follow-up', input.model, exceptionIds),
      ],
      overlays: exceptions.map((item) =>
        marker(
          `asset-handover/${item.subjects[0] ?? ''}/${item.field}`,
          `${item.subjects[0] ?? ''}: ${item.field} ${item.observation.kind === 'missing' ? item.observation.reason : 'conflicting'}`,
          outcomeOfObservation(item.observation),
          onObject(keyOf(input.model, item.subjects[0] ?? '')),
        ),
      ),
      view: suggestedView('asset-handover', 'Assets needing handover follow-up', keysOf(input.model, exceptionIds), rules),
      selectSetId: 'asset-handover/exceptions',
    }),
    diagnostics,
  );
};

// Asset handover and maintenance: every asset gets a handover row with its known event count and
// last service date; a missing install date and an untracked service history are reported as
// exceptions, and a genuinely empty but tracked history is never confused with an untracked one.
export const assetHandoverWorkflow: Workflow = workflow({
  id: 'asset-handover',
  title: 'Asset handover and maintenance',
  description:
    'One row per asset with its known maintenance event count and last service date. A missing or disputed ' +
    'install date and a service history that was never tracked are each reported as their own exception; a ' +
    'tracked history with zero events so far is a legitimate known fact, not an exception.',
  basis: 'synthetic',
  input: assetHandoverInputSchema,
  run: runAssetHandover,
});
