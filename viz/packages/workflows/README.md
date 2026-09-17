# @bim-open-toolkit/workflows

Pure result adapters for the ten review workflows in the product brief. Input tables go in; a typed
result comes out carrying result tables, an exceptions table, style rules, object sets, overlay data,
a suggested saved view and a recipe of the commands a demonstration dispatches.

Nothing here renders, fetches or touches a browser. The only dependency is `@bim-open-toolkit/model`.

## What it is for

A domain result — a door schedule, a takeoff, a carbon total — has to reach a viewer without the
viewer learning the domain, and without the trip inventing anything. That is the whole job of this
package: read the tables a workflow service produced, decide only what the stated rules allow, and
hand back plain data a scene can be built from.

The rule every adapter follows is that a gap stays a gap. A quantity nobody measured is not zero, a
match nobody settled is not an addition, and a bounding-box overlap is not a clash. Anything the
adapter cannot decide goes to the exceptions table with the reason, the disputed values, or the
candidates that are still open, and stays visible in the result rather than being dropped.

## What it does not do

- No BIM calculation. Areas, costs, carbon factors, network topology and correspondences are supplied
  as input. This package multiplies and adds supplied numbers under stated rules; it derives no
  quantity from geometry and proposes no correspondence of its own.
- No rendering, no I/O, no clock. Every function is a pure function of its input.
- No commands. A recipe carries the command *names* a demonstration will dispatch, matched to the
  names the feature packages export; this package never dispatches one itself.
- No coverage of every real source. Only the door schedule has a real-data counterpart today.

## Using one

```ts
import { parse } from '@bim-open-toolkit/model';
import { doorScheduleInputSchema, runDoorSchedule, exceptionRows, resultRows } from '@bim-open-toolkit/workflows';

const input = parse(doorScheduleInputSchema, json);
if (input.ok) {
  const result = runDoorSchedule(input.value);
  if (result.ok) {
    resultRows(result.value, 'schedule');   // one row per door
    exceptionRows(result.value);            // what could not be decided, and why
    result.value.rules;                     // colour by result
    result.value.recipe.steps;              // the commands a demonstration dispatches
  }
}
```

Every workflow is also in the registry, which is what a generated tool descriptor or a gallery reads:

```ts
import { workflows, describeWorkflows, runWorkflow } from '@bim-open-toolkit/workflows';

describeWorkflows(workflows);               // id, title, basis and input JSON schema for each
runWorkflow(workflows, 'door-schedule', json);  // validates the input, then runs
```

## How it is organised

| Module | Holds |
|---|---|
| `values.ts` | `ResultValue`, `ResultRecord`, `ResultTable` and the row builder that leaves absent fields out |
| `observation.ts` | The JSON form of model's `Observation`, its schema, and how one is written into a row |
| `exception.ts` | `WorkflowException`: one shape for all ten workflows, carrying an observation |
| `outcome.ts` | The five outcomes a result colours by, their appearance and their precedence |
| `overlay.ts` | Markers, labels and directed lines, anchored to an object or to a point |
| `keys.ts` | Object keys, named sets, duplicate and unknown-reference diagnostics, the suggested view |
| `recipe.ts` | The public command names and the standard ordered recipe |
| `result.ts` | `WorkflowResult` and its builder |
| `workflow.ts` | The registry-facing `Workflow`, which validates its own input |
| `01-…` to `10-…` | One workflow each: its input types, its input schema, its `run`, its descriptor |
| `door-projection.ts` | The door table of an `ara3d.building-workflow-projection` envelope as schedule input |

`docs/workflows.md` describes each workflow: its inputs, its rules, what its result does and does not
say, and whether its demonstration is synthetic, source-backed or mixed.

## Tested

`npm test -w @bim-open-toolkit/workflows`. Each workflow has a test that runs the adapter on the
fixture in `test/expected/` and compares its result rows and exception rows exactly against the
expected file. Those files were written by hand from the product brief before any adapter existed, so
they are acceptance tests rather than a record of what the code happens to do; every correction made
to one is listed in `docs/CHECKPOINT-W.md` with its reason.

The door schedule is additionally tested against a hand-made sample in the shape of a real
BuildingModel workflow projection. No private artifact is read by any test.

Several workflows are also run against `@bim-open-toolkit/synthetic`'s generators, which publish
their observations as model facts and their deliberate gaps as model coverage. Those tests assert
that the exceptions are exactly the gaps the generator documents, so the two packages have to agree
about what is missing rather than both being checked against the same hand-written numbers.

Not tested here: any behaviour that needs a renderer, which is by design outside this package.
