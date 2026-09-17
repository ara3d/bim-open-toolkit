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
import { line, onObject, type Overlay } from './overlay.js';
import { groupByOutcome, outcomeRules, type Outcome } from './outcome.js';
import { enumeration } from './schema-tools.js';
import { workflowResult, type WorkflowResult } from './result.js';
import { resultRecord, resultTable, type ResultRow } from './values.js';
import { workflow, type Workflow } from './workflow.js';

// A pipe junction, fixture or valve location the trace can traverse through.
export type IsolationNode = { readonly nodeId: string };

// Whether a segment's connection is trusted topology or has not been confirmed.
export type TopologyStatus = 'accepted' | 'unverified';

// One pipe or duct segment joining two nodes.
export type IsolationSegment = {
  readonly objectId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly topologyStatus: TopologyStatus;
};

// One valve, sitting at a node; closing it blocks traversal through that node.
export type IsolationValve = { readonly objectId: string; readonly nodeId: string };

// The isolation trace's input: the network, which valves are closed, and where the trace begins.
export type ValveIsolationInput = {
  readonly model: ModelRef;
  readonly startNodeId: string;
  readonly closedValveIds: readonly string[];
  readonly nodes: readonly IsolationNode[];
  readonly segments: readonly IsolationSegment[];
  readonly valves: readonly IsolationValve[];
};

const topologyStatusSchema: Schema<TopologyStatus> = enumeration(['accepted', 'unverified']);

// The JSON a valve isolation trace is given.
export const valveIsolationInputSchema: Schema<ValveIsolationInput> = object({
  model: modelRefSchema,
  startNodeId: string(),
  closedValveIds: array(string()),
  nodes: array(object({ nodeId: string() })),
  segments: array(
    object({
      objectId: string(),
      fromNodeId: string(),
      toNodeId: string(),
      topologyStatus: topologyStatusSchema,
    }),
  ),
  valves: array(object({ objectId: string(), nodeId: string() })),
});

// One step of the traversal: the node reached, the accepted segment that reached it (absent for the
// start node, which the trace begins at rather than reaches), and the segment that reached the node
// this step came from, which is the segment this one actually continues.
type TraceStep = {
  readonly nodeId: string;
  readonly reachedVia: string | undefined;
  readonly continues: string | undefined;
};

type Edge = { readonly segment: IsolationSegment; readonly otherNodeId: string };

const acceptedSegments = (segments: readonly IsolationSegment[]): readonly IsolationSegment[] =>
  segments.filter((segment) => segment.topologyStatus === 'accepted');

const edgesAt = (nodeId: string, segments: readonly IsolationSegment[]): readonly Edge[] =>
  segments.flatMap((segment) =>
    segment.fromNodeId === nodeId
      ? [{ segment, otherNodeId: segment.toNodeId }]
      : segment.toNodeId === nodeId
        ? [{ segment, otherNodeId: segment.fromNodeId }]
        : [],
  );

// A breadth-first traversal of the accepted segments from `startNodeId`, refusing to pass through
// any node in `blockedNodeIds`. A blocked node is still visited (it is where the trace stops); its
// neighbours beyond it are not.
const traceFrom = (
  startNodeId: string,
  accepted: readonly IsolationSegment[],
  blockedNodeIds: ReadonlySet<string>,
): readonly TraceStep[] => {
  const order: TraceStep[] = [{ nodeId: startNodeId, reachedVia: undefined, continues: undefined }];
  const visited = new Set<string>([startNodeId]);
  const queue: TraceStep[] = [...order];
  for (;;) {
    const current = queue.shift();
    if (current === undefined) return order;
    if (blockedNodeIds.has(current.nodeId)) continue;
    for (const edge of edgesAt(current.nodeId, accepted)) {
      if (visited.has(edge.otherNodeId)) continue;
      visited.add(edge.otherNodeId);
      const step: TraceStep = {
        nodeId: edge.otherNodeId,
        reachedVia: edge.segment.objectId,
        continues: current.reachedVia,
      };
      order.push(step);
      queue.push(step);
    }
  }
};

const segmentIdsOf = (steps: readonly TraceStep[]): readonly string[] =>
  steps.flatMap((step) => (step.reachedVia === undefined ? [] : [step.reachedVia]));

// The closed valve at a node, or nothing when no closed valve sits there.
const closedValveAt = (
  nodeId: string,
  valves: readonly IsolationValve[],
  closedValveIds: readonly string[],
): string | undefined => valves.find((valve) => valve.nodeId === nodeId && closedValveIds.includes(valve.objectId))?.objectId;

const affectedRow = (
  step: TraceStep,
  valves: readonly IsolationValve[],
  closedValveIds: readonly string[],
): ResultRow => {
  const closedValveId = closedValveAt(step.nodeId, valves, closedValveIds);
  return resultRecord({
    nodeId: step.nodeId,
    reachedVia: step.reachedVia,
    note: closedValveId === undefined ? undefined : `closed valve ${closedValveId} stops the trace beyond this node`,
  });
};

// An unverified segment that touches the affected set, reported as a trace-coverage gap: it might
// extend the affected area, but its connection is not accepted topology, so it stays out of the set.
const coverageException = (segment: IsolationSegment, affectedNodeIds: ReadonlySet<string>): WorkflowException => {
  const touchingNodeId = affectedNodeIds.has(segment.fromNodeId) ? segment.fromNodeId : segment.toNodeId;
  const otherNodeId = touchingNodeId === segment.fromNodeId ? segment.toNodeId : segment.fromNodeId;
  return workflowException([segment.objectId], 'topologyStatus', missing('unresolved-source'), {
    detail: `unverified topology touching affected node ${touchingNodeId}; may extend the affected set toward ${otherNodeId}`,
  });
};

const referenceDiagnostics = (input: ValveIsolationInput): readonly Diagnostic[] => {
  const nodeIds = new Set(input.nodes.map((node) => node.nodeId));
  const valveIds = new Set(input.valves.map((valve) => valve.objectId));
  return [
    ...(nodeIds.has(input.startNodeId)
      ? []
      : [unknownReferenceDiagnostic('valve-isolation', 'startNodeId', input.startNodeId)]),
    ...input.closedValveIds.flatMap((valveId) =>
      valveIds.has(valveId) ? [] : [unknownReferenceDiagnostic('valve-isolation', 'closedValveIds', valveId)],
    ),
    ...input.segments.flatMap((segment) => [
      ...(nodeIds.has(segment.fromNodeId) ? [] : [unknownReferenceDiagnostic('segments', 'fromNodeId', segment.fromNodeId)]),
      ...(nodeIds.has(segment.toNodeId) ? [] : [unknownReferenceDiagnostic('segments', 'toNodeId', segment.toNodeId)]),
    ]),
    ...input.valves.flatMap((valve) =>
      nodeIds.has(valve.nodeId) ? [] : [unknownReferenceDiagnostic('valves', 'nodeId', valve.nodeId)],
    ),
  ];
};

// The valve isolation trace: the affected nodes and segments reached from `startNodeId` over
// accepted topology only, stopping at every closed valve, with every unverified segment that
// touches the affected set reported as a trace-coverage gap rather than guessed either way.
export const runValveIsolation = (input: ValveIsolationInput): Result<WorkflowResult> => {
  const duplicates = [
    ...duplicateDiagnostics('nodes', input.nodes.map((node) => node.nodeId)),
    ...duplicateDiagnostics('segments', input.segments.map((segment) => segment.objectId)),
    ...duplicateDiagnostics('valves', input.valves.map((valve) => valve.objectId)),
  ];
  if (duplicates.length > 0) return failure(duplicates);

  const diagnostics = referenceDiagnostics(input);
  const accepted = acceptedSegments(input.segments);
  const blockedNodeIds = new Set(
    input.valves.filter((valve) => input.closedValveIds.includes(valve.objectId)).map((valve) => valve.nodeId),
  );

  const affected = traceFrom(input.startNodeId, accepted, blockedNodeIds);
  const affectedNodeIds = new Set(affected.map((step) => step.nodeId));
  const affectedSegmentIds = segmentIdsOf(affected);

  // Traced without the valve closures, so the segments cut off by a closed valve (which are working
  // as intended, not a gap) can be told apart from segments that were never part of the network.
  const unblocked = traceFrom(input.startNodeId, accepted, new Set());
  const excludedSegmentIds = segmentIdsOf(unblocked).filter((id) => !affectedSegmentIds.includes(id));

  const exceptions = input.segments
    .filter((segment) => segment.topologyStatus === 'unverified')
    .filter((segment) => affectedNodeIds.has(segment.fromNodeId) || affectedNodeIds.has(segment.toNodeId))
    .map((segment) => coverageException(segment, affectedNodeIds));
  const exceptionSegmentIds = exceptions.flatMap((item) => item.subjects);

  const closedValveIdsReached = [...blockedNodeIds]
    .filter((nodeId) => affectedNodeIds.has(nodeId))
    .flatMap((nodeId) => {
      const valveId = closedValveAt(nodeId, input.valves, input.closedValveIds);
      return valveId === undefined ? [] : [valveId];
    });

  const rules = outcomeRules(
    'valve-isolation',
    groupByOutcome([
      ...affectedSegmentIds.map((id): readonly [string, Outcome] => [keyOf(input.model, id), 'resolved']),
      ...exceptionSegmentIds.map((id): readonly [string, Outcome] => [keyOf(input.model, id), 'missing']),
      ...excludedSegmentIds.map((id): readonly [string, Outcome] => [keyOf(input.model, id), 'excluded']),
    ]),
  );

  // A directed line for each hop of the trace, from the segment a step continues to the segment that
  // made the step. The two share the node the trace passed through, so the line is a connection the
  // accepted topology actually states rather than two segments that happen to be adjacent in order.
  const overlays: readonly Overlay[] = affected.flatMap((step) =>
    step.reachedVia === undefined || step.continues === undefined
      ? []
      : [
          line(
            `valve-isolation/${step.continues}-${step.reachedVia}`,
            `Trace continues from ${step.continues} to ${step.reachedVia}`,
            'resolved',
            onObject(keyOf(input.model, step.continues)),
            onObject(keyOf(input.model, step.reachedVia)),
          ),
        ],
  );

  return resultOf(
    workflowResult({
      id: 'valve-isolation',
      title: 'Valve isolation trace',
      model: input.model,
      tables: [resultTable('affected', 'Affected nodes', affected.map((step) => affectedRow(step, input.valves, input.closedValveIds)))],
      summary: {
        affectedNodeCount: affected.length,
        affectedSegmentCount: affectedSegmentIds.length,
        exceptionCount: exceptions.length,
      },
      exceptions,
      rules,
      sets: [
        namedObjectSet('valve-isolation/affected', 'Affected segments', input.model, affectedSegmentIds),
        namedObjectSet('valve-isolation/exceptions', 'Trace-coverage exceptions', input.model, exceptionSegmentIds),
        ...(closedValveIdsReached.length === 0
          ? []
          : [namedObjectSet('valve-isolation/closed-valves', 'Closed valves reached', input.model, closedValveIdsReached)]),
      ],
      overlays,
      view: suggestedView('valve-isolation', 'Valve isolation trace', keysOf(input.model, affectedSegmentIds), rules),
      selectSetId: 'valve-isolation/affected',
    }),
    diagnostics,
  );
};

// Valve isolation trace: which pipework is affected by closing the given valves, and which
// unverified connections at the edge of that trace still need to be checked by hand.
export const valveIsolationWorkflow: Workflow = workflow({
  id: 'valve-isolation',
  title: 'Valve isolation trace',
  description:
    'Traces the network from a start node over accepted topology only, stopping at every closed valve. ' +
    'An unverified segment that touches the affected set is reported as a trace-coverage gap; it is never ' +
    'silently included in or excluded from the affected set as if it were known.',
  basis: 'synthetic',
  input: valveIsolationInputSchema,
  run: runValveIsolation,
});
