# Proposed Parallel Wave guidance improvements

Reviewed September 7, 2026 against the installed `C:/Users/cdigg/.codex/skills/parallel-wave/SKILL.md` and its `references/templates.md`. These are proposed general skill additions, not an installed personal-skill update. Applicable project rules are recorded in the repository AGENTS.md and visualization plan.

## Preserve plans explicitly

Add under **Choose and plan**, and clarify the template introduction:

> Templates extend existing planning documents; they must not replace original requirements, rationale, feature detail or acceptance criteria with rolling status. Retain the source brief and a durable plan. Keep execution status and checkpoints separately identified. Record scope changes and deferrals with their reason and authority, retaining original requirement IDs and links. Before committing a plan change, inspect removed text for lost or weakened requirements. Archive material superseded plans before replacement.

The existing “Reuse project documents” wording is ambiguous. The existing prohibition against silently dropping acceptance criteria already applies; the coordinator failed to enforce it adequately.

## Dispatch continuously within real capacity

Add under **Own before dispatch** or **Work and report**:

> Record available capacity, including the supervisor and any nested agents. Maintain a short queue of bounded tasks tied to unmet acceptance criteria with explicit readiness conditions. When a worker finishes, check its deliverable and assign the next ready task without waiting for unrelated tracks. Reuse suitable workers with a fresh bounded packet. Keep slots idle when useful independent work is unavailable; do not invent reviews or extensions for occupancy. Prioritize shared prerequisites that unblock multiple ready tasks.

This session has four total slots: one coordinator and up to three workers. That is a host limit, not a universal number to hard-code into the skill. More concurrency is only useful when files, inputs and resources can remain independent.

## Put one outcome in each packet

For UI work, add the original requirement/stage, one public API outcome, standalone mini demo, lifecycle/cleanup behavior and meaningful acceptance cases to the existing packet. Share small fixtures and stable host contracts, not a large feature-filled viewer. A worker can own module + tests + demo + documentation in exclusive paths; gallery registration remains centrally owned.

Add `next ready task / blocked by` and a task-specific reassessment condition to checkpoints. A reassessment condition can be repeated failure without new evidence, an unexpected shared-contract dependency or work expanding beyond the bounded stage. Use actual token counters when available; never invent token consumption. Checkpoint and diagnose before pausing/reassigning, as the skill already requires. Do not repeatedly replace a struggling worker or erase unmet acceptance to declare success.

## Budget test resources across the machine

Extend resource ownership to CPU, memory, GPU and browser capacity. Focused tests may overlap when inputs are stable and outputs independent. Schedule expensive shared builds and GPU/browser checks centrally until measured capacity supports safe overlap. Independent output directories do not make mutable input trees stable. Reuse passed evidence while its inputs remain unchanged.

For this project, keep one Snowdon browser lane initially. Other workers can implement and run small pure tests while that lane validates a stable completed feature. Run a real model-loading and visible-error smoke test early when loader/server/host inputs change. Do not wait until the last integration wave to discover an HTML response masquerading as a model archive. Record service ownership, start command, readiness check and intended lifetime; verify the user-facing server is still reachable at handoff.

## Reconcile before completing a wave

Add a compact requirement reconciliation to the integration template: original F-ID/stage, promised outcome, implemented subset, evidence, unmet acceptance and explicit deferral. Check that no stale active assignments remain. Implementation, local verification, integrated verification and product release qualification are distinct.

## Concrete scheduling pattern

| Slot | Useful work | Avoidable bottleneck |
|---|---|---|
| Coordinator | Finalize next contracts; integrate one stable result; validate Snowdon; maintain original scope and ready queue | Becoming a fourth feature writer while three workers wait for exports/contracts |
| Worker 1 | One independent API + focused tests + mini demo | Editing shared gallery host or broad manifests |
| Worker 2 | Another ready feature or a targeted test of a stable completed feature | Testing half-written shared inputs |
| Worker 3 | Another ready feature, bounded investigation or required qualification | Duplicate investigation or review with no unresolved acceptance question |

The slot roles can change at each completion. Measure completed verified outcomes, coordinator wait, rework and expensive-test contention; agent occupancy alone is not a success metric. Extra user-facing tasks or nested agents do not bypass the current concurrency limit. A larger host pool would still need independent work and adequate machine resources.
