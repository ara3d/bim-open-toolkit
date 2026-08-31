# Proposal: seven agent workflows

Status: proposal. These workflows are not built yet. They combine ideas from
three repositories — `platonic-ts`, `Platonic.CSharp` (its
`agent-development-framework.md`), and `dotnet-greenhouse` — with the practices
already used in this repository (the parallel wave, `CONTRACTS.md`, `NOTES.md`).
See `docs/proposals/agent-archetypes.md` for the source material on agent roles.

The workflows fit together. Workflow 1 runs first on every task and decides how
much of the rest applies. Small tasks stay fast; only risky work pays for
ceremony. If small tasks ever start accumulating ceremony, the system has
failed its own test.

One idea underlies everything here: **rules that agents must remember will be
forgotten; rules that a tool enforces will not.** Wherever possible, each
workflow leans on a gate, a hook, or a script rather than on an instruction in
a prompt.

---

## 1. Size up the task (planning)

**When:** before any task that will edit source code. Skipped for docs-only
changes.

Before work starts, a cheap, fast agent rates the task in one minute:

- **light** — small change, well covered by tests. Go straight to workflow 3.
  No ceremony.
- **normal** — adds or changes a public surface, or touches a moderate amount
  of code. Design the surface first (workflow 2), then build.
- **risky** — touches many dependents, code with poor test coverage, or files
  with a history of reverts. Design first, adversarial tests (workflow 4), and
  a review before merge.

The rating is based on facts, not gut feel: how many things depend on the code
being touched, whether tests cover it, and whether those files have been
reverted before. All of these can be read from existing tools (dependency
graphs, coverage, git history). The rating is written into the task item so a
bad call can be found and studied later.

**Why it works:** effort follows risk instead of being the same for everything.
The rating agent is a classifier over numbers that already exist — its value is
in running every time, cheaply, not in deep thinking.

---

## 2. Contract first (designing)

**When:** the task adds or changes a public surface, or the work will be split
across parallel agents. **Skipped** when the change is internal to one file —
running it there just adds a handoff.

An agent writes *only* the type signatures, interfaces, and test stubs for the
feature — never function bodies. The result compiles, and fails its own tests
on purpose (the stubs throw "not implemented").

The human (or a reviewing agent) looks at this skeleton *before* any
implementation exists. This is the moment a bad design is cheapest to fix:
changing a signature costs nothing when there are no bodies behind it.

Implementation then starts against a frozen surface. When work is split across
parallel agents, the contract doubles as the fence — every implementer builds
against the same fixed types and cannot drift.

**Why it works:** it separates "decide what correct means" from "write the
code," and reviews happen at the point of maximum leverage. This is already
how BimOpenFlow Wave 0 works (spec, contracts, and Abstractions land before
anything fans out); this workflow just names the practice and adds the skip
rule.

---

## 3. Build in gated steps (executing)

**When:** every implementation task. This is the everyday workflow.

The agent receives a **work order** — a short structured brief the supervisor
prepares:

- the goal, in a sentence or two
- the exact files the agent may touch (the fence)
- the done-criteria, as checks a machine can run
- a pointer to one exemplar file to imitate (agents imitate better than they
  follow rules)
- a budget (time or tokens)

The agent then loops the standard workflow from `CLAUDE.md`: smallest useful
slice, build, test, commit with a pathspec. Two additions make it safe to
leave the agent alone:

1. **A hook compile-checks every edit** the moment it lands (about two
   seconds). Mistakes surface immediately, not at the next full build.
2. **An escalation clause:** if the same check fails three times, or the fix
   needs a file outside the fence, the agent stops and writes a short
   stuck-report — what it tried, what exactly failed. A structured way to give
   up turns thrashing into a routing decision.

Done is a gate verdict, never the agent's own claim. A report of "all tests
pass" without a green gate run does not count.

**Why it works:** verification is interleaved with every step, so errors
cannot pile up silently, and the worst agent failure mode — thrashing — has a
cheap exit.

---

## 4. Adversarial tests for risky work (testing)

**When:** tasks rated risky, or anything touching parsing, concurrency, or
code with a history of regressions. **Skipped** for light tasks and pure
refactors, where existing tests already define the behavior.

The tests are written *before* the implementation, *by a different agent* than
the one who will build it. That agent is told plainly: "assume the implementer
will do the laziest thing that passes the happy path — write the tests that
catch that." Its tests land alongside the contract stubs from workflow 2, so
the builder can never write tests that flatter the code.

At merge time, two mechanical checks the model cannot fake:

- every changed line must be exercised by at least one test
- mutation testing on the changed lines confirms the tests actually assert
  something (a test that runs code but checks nothing is caught here)

Day to day, run only the tests the change can affect — computed from the
project dependency graph — and the full suite only at merge. This is the
`CLAUDE.md` rule "match the test scope to the blast radius," implemented as a
tool instead of an instruction.

**Why it works:** it separates "what should be true" from "what I built" —
the basic conflict of interest in testing — and backs it with checks that
cannot be gamed.

---

## 5. Parallel wave (executing at scale)

**When:** several independent pieces of one feature can be built at the same
time by multiple agents on one machine.

This is the existing parallel-wave process (supervisor, fenced tracks,
contracts land first, findings to `NOTES.md`), with three additions borrowed
from a process that was run hard in practice:

1. **Pre-flight fence check.** Before spawning any agents, verify against the
   real dependency graph that the tracks' claimed files are actually disjoint.
   Refuse tracks whose fences overlap. This is the cheapest possible insurance
   against the worst wave failure: agents overwriting each other's work.
2. **Ownership is per-file, not per-task.** No two in-flight agents may touch
   the same file, ever. Work that overlaps goes in a later wave.
3. **Merge gate.** One full green build-and-test run per track. Merge one
   track at a time; never batch-merge. A dedicated integrator agent pulls each
   track in, fixes seam breakage, and appends findings — so the supervisor's
   context stays clean for supervising.

**Why it works:** every one of these rules exists because its absence caused a
real failure somewhere. Fences that turn out to be fictional, two agents in
one file, and batch merges are the three classic ways a wave goes wrong.

---

## 6. Continuous tending (maintaining)

**When:** on a schedule (nightly or weekly), unattended. Never while a wave is
in flight or the working tree is dirty — the tender never races active work.

A cheap agent runs a **fixed, whitelisted menu** of janitorial tasks: prune
unused exports, regenerate drifted doc indexes, close backlog items whose code
has vanished, normalize formatting. Each action is one small commit, passing
the normal gate like any other change. Anything ambiguous — an unused export
that might be a public seam — is filed as a question, never deleted.

The whitelist is the safety mechanism: the agent's diligence is trusted, its
judgment never is.

Pair this with a **ratchet**: a committed file holding counts of the things
that should only shrink — suppressed warnings, TODOs, escape hatches,
oversized files. A count may go down (the baseline tightens automatically) but
a change that makes a count go up fails the build.

**Why it works:** entropy gets paid down continuously in boring, individually
revertable commits, and the ratchet guarantees the direction of travel without
anyone having to schedule cleanup. This is proven in practice: the ratchet in
`platonic-ts` drove its unsafe-cast and undocumented-export counts steadily
down.

---

## 7. Safe refactoring (refactoring)

**When:** improving structure without changing behavior. Two rules gate entry:

1. **Never refactor on red.** If tests are failing, get them green first
   (already the `CLAUDE.md` rule).
2. **Never refactor untested code.** If the target has no covering test,
   file a task to write the test first, and stop. Shrinking untested code is
   refactoring blind.

Then the mechanics:

- **Preview before apply.** Compute the change and show the diff before
  touching disk. Apply only on an explicit go.
- **Verify after apply.** Compile immediately; roll back automatically if it
  fails. A refusal ("this rename is not safe, here is why") is more valuable
  than a half-applied change.
- **One rename, one function, one move per commit** — every step independently
  revertable, every diff trivially reviewable.
- **Prove equivalence where the code is pure.** Run the old and new versions
  on many generated inputs and confirm identical outputs. This upgrades "this
  refactor should be safe" to "demonstrated equivalent over N inputs" — and it
  is only possible where the purity rules hold, because pure functions have no
  hidden state to smuggle a difference through. This is a concrete payoff of
  adopting the Platonic analyzers on the engine code.

**Why it works:** the model supplies intent; a deterministic tool computes the
exact edit; the compiler and tests prove it. The error-prone middle step —
hand-editing many call sites — is removed from the model entirely.

---

## The loop that improves the loop

One meta-habit ties the seven workflows together: **friction becomes tooling,
on evidence.**

- **Record friction automatically.** Hooks and tool wrappers append events to
  a log — a gate that failed twice the same way, an agent falling back to
  grep because a search tool came up empty, the same doc read three times in
  one session. Instrumentation, not discipline: agents are never asked to
  remember to log.
- **Study real failures, briefly.** After a revert or a bug, write a short
  post-mortem answering exactly two questions: what signal existed beforehand,
  and which gate or workflow should have caught it. Failures with no lesson
  (flaky external dependency, one-off mistake) get no post-mortem — writing
  post-mortems for noise trains everyone to ignore them.
- **Promote on the third occurrence.** When the same pain shows up about three
  times, it graduates: into a hook, a gate rule, a skill fix, or a script.
  Once it is a script, it stops costing tokens forever.
- **No evidence, no tool.** Nothing gets built speculatively. This threshold
  is the guard against the system growing machinery nobody needed — and all
  three source repositories arrived at it independently.

---

## What exists today vs. what needs building

| Workflow | Ready to lift | Needs building |
|---|---|---|
| 1. Size up | blast-radius / coverage / history tools | the small rating skill |
| 2. Contract first | already this repo's practice | a skip rule and a named skill |
| 3. Gated steps | patch-gate hook, ledger templates (greenhouse kit) | work-order and stuck-report formats |
| 4. Adversarial tests | impacted-test pattern (greenhouse) | test-first agent role; mutation testing at merge |
| 5. Parallel wave | parallel-wave skill, kit playbooks | pre-flight fence check |
| 6. Tending | ratchet + init (platonic-ts), sweep (greenhouse) | the whitelist menu and schedule |
| 7. Safe refactoring | preview-first refactoring tools + skills (greenhouse) | equivalence harness (needs the purity analyzers) |
| Meta loop | transcripts + hooks packages (platonic-ts) | friction-event emitters; post-mortem skill |

A caution that applies to every "ready to lift" cell: all three source
repositories are unpublished prototypes. Their process documents and templates
are safe to adopt as-is; their packaged tools must be built from source and
verified against this repository before agents depend on them.
