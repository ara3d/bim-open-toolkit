# PlatoFlow / Studio — what is an "agent"? A design brainstorm

> **AI-assisted design document** (Claude + Christopher Diggins, 2026-08-30).
> Companion to `platoflow-ifc-design.md` (core design; P3 makes MCP agents first-class
> users), `platoflow-v1-nodes.md` (the `ai.ask` node and the deterministic boundary),
> `platoflow-compliance-design.md` (five-category verdicts, rule/citation discipline),
> and the wider governance vision in `nrc-ifc-llm/ai_assisted_architecture_design_system.md`
> (git-like design history; the 9-step agent proposal protocol). Background: Studio 2.5's
> AEC world model (deep search shows what an asset IS; the world model lets you design
> what it COULD BECOME) and WorkQuarry as a candidate git-native per-user ledger of
> decisions, agents, and skills.
>
> Scope: **brainstorm, not specification.** The word "agent" is already load-bearing in
> three different places in the existing designs — the MCP graph author (P3), the `ai.ask`
> node resident inside a graph, and the supervised proposal-maker of the governance
> vision — and those are three different things with different trust stories. This
> document maps the space wide, then argues for one unit of agent definition and one
> minimal V1 agent. Nothing here amends the release ladder.

## 0. What the existing designs already commit us to

Four commitments constrain any answer, and they are good constraints:

1. **The deterministic boundary** (compliance design §5, restated on `ai.ask`): an LLM
   produces *data* — facts, drafts, SQL, tables — never verdicts. Every verdict is
   deterministic execution of approved rules over stated facts. Whatever "agent" means,
   it cannot mean "a thing that grades buildings."
2. **One edit path** (P2/P3): every graph mutation, human or agent, is an Intent through
   the single reducer. An agent has no privileged write channel; it has the same hands
   a human has, and everything it does is undoable, reviewable, and animated into view.
3. **Artifacts are git-native documents**: graphs are diffable JSON, rules are immutable
   versioned IR, backlog items and decisions are markdown-plus-frontmatter files
   (WorkQuarry format). An agent's outputs land in this world or they evaporate.
4. **The proposal protocol** (governance doc): a material agent contribution is a
   structured proposal — interpretation of the request, assumptions, artefacts inspected,
   proposed changes, semantic diffs, checks run, risks, human review, per-change
   disposition. Nine steps, none optional for anything that touches the project record.

The question this document actually answers: given those commitments, what *kinds* of
agents are worth having, what varies between them, and what file do you edit when you
want to make one?

---

## 1. Taxonomy: candidate meanings of "agent"

Go wide first. Each entry: what it reads, what it writes, cadence (interactive /
triggered / scheduled / continuous), and trust level. Trust levels used throughout:

- **T0 — advisory**: output is prose/data for a human; touches no project record.
- **T1 — proposer**: writes drafts and proposals (graphs, rule drafts, issues) that a
  human dispositions; nothing it writes is authoritative until accepted.
- **T2 — bounded actor**: executes pre-approved deterministic artifacts (runs an
  approved graph, files its outputs) without per-run review; may not author or modify
  the artifacts it runs.
- **T3 — autonomous**: acts and commits without review. Deliberately empty in this
  document. Nothing below needs it, and the governance doc's whole point is that AEC
  professional responsibility resists it.

### 1.1 Authoring and analysis agents

**Graph-authoring copilot.** The P3 agent, promoted from tool to persona. Reads: node
registry, the current graph, evaluated wire values, the model's schema. Writes: Intents
(add/connect/set-param), arriving selected and undoable. Cadence: interactive, inside a
session. Trust: T1 — its "proposal" is the subgraph sitting selected on the canvas, and
review is Ctrl-Z. This is the cheapest trust loop in the whole taxonomy because the
platform already built it: the reducer *is* the review gate.

**Resident node (`ai.ask` and descendants).** An LLM living *inside* a graph as a node:
question in, SQL out, table out, generated query displayed. Reads: the input scene's
schema and data plane. Writes: a wire value only — never a file, never an Intent.
Cadence: evaluated like any node, memoized on inputs. Trust: T0/T1 — its output flows
onward as data, and anything compliance-shaped must pass `verdict.fromTable` validation.
The V2 `ai.classify` node is the same shape. Key property: a resident node's "agency" is
bounded by its sockets. It cannot see the graph it lives in, cannot edit anything, and
its whole contribution is one typed value. This is the most domesticated agent form and
should stay that way.

**Model-diff summarizer.** Reads: two checkpoints of a model (V2+ `model.diff` output),
the decision records near them. Writes: a suggested checkpoint description, a list of
likely-affected analyses, candidate "undocumented decision" flags. Cadence: triggered on
checkpoint creation. Trust: T0 for the prose, T1 for the flags (each flag is a draft
issue a human accepts or dismisses). The governance doc's "12 rooms moved, net area
unchanged, circulation increased 4.2%" line is this agent's voice.

**Takeoff estimator.** Reads: quantities graphs (V1 workflows 21–24), rate tables,
historical cost records from the firm knowledge base. Writes: a draft estimate table
plus the graph that produced it — the graph is the deliverable, the numbers are its
evaluation. Cadence: interactive or triggered on model checkpoint. Trust: T1. Note the
pattern, which recurs: the agent's real product is a *deterministic replayable artifact*
(the graph); the LLM contribution is choosing joins, mapping messy type names to rate
lines, and drafting the assumptions section.

**Code-provision encoder.** The V3.1 rule-authoring assist as a standing role. Reads:
digitalized code text (RASE/DITA/JSON-LD), the fact vocabulary, the reference corpus.
Writes: rule IR with `status: draft`, corpus test results, a side-by-side review request
for a code expert. Cadence: batch, per code edition; then triggered per amendment.
Trust: T1 with a hard structural ceiling — the IR schema itself enforces that drafts
are not executable as approved rules. This is the agent with the longest-lived output
(rules are immutable once approved) and therefore the heaviest review discipline.

### 1.2 Watching and auditing agents

**Background auditor.** Reads: a set of saved QA graphs (workflows 1–9), model file
hashes. Writes: verdict streams, a report per run, a delta-vs-last-run summary; files an
issue when a previously-passing check fails. Cadence: triggered by model change (the
stale-badge machinery already detects this) or scheduled. Trust: T2 — it runs *approved*
graphs it did not author; its judgment is confined to the summary prose. This is the CI
analogy made literal, and the V2 batch runner is its engine: batch is a for-loop around
the headless evaluator, and the auditor is a for-loop with a notification policy.

**Data steward / drift watcher.** Reads: BOS conversion outputs across versions —
schema version markers, parameter-type enums, entity counts, null fractions per column.
Writes: drift reports; issues when a conversion changes shape (the PoC's live off-by-one
in the parameter-type enum is exactly what this agent exists to catch). Cadence:
triggered per conversion. Trust: T2. Cheap to build — it is mostly `table.stats` graphs
plus thresholds — and disproportionately valuable, because *plausible wrong data* is the
failure class nothing else in the system catches.

**Compliance reviewer.** Reads: a model checkpoint, the approved rule library for the
declared jurisdiction/edition, the classification determination. Writes: it *runs* the
deterministic permit-check workflow and files the resulting verdicts, the
`InfoNotAvailable` request-for-information list, and a draft report. Cadence: triggered
at review milestones. Trust: T2 for execution, T1 for anything interpretive — every
`Uncertain` verdict routes to a human by construction, and the agent's added value is
assembling the evidence chain for that human, not resolving it. This agent never gets
override authority; overrides are human Intents with mandatory reasons.

**Portfolio scanner.** The same auditor lifted one level: reads many models across a
portfolio, runs the same graph-as-function over each (V2 graph parameters + batch
runner), writes a cross-asset table — which buildings lack fire ratings, which exceed
carbon targets, which have stale energy models. Cadence: scheduled. Trust: T2. The
world-model framing matters here: deep search answers "what does asset X have," the
scanner answers "which of my 400 assets fail predicate P," and the predicate is a
versioned graph, not a prompt.

**Digital-twin observer.** Reads: sensor/IoT streams, occupancy data, energy meters,
mapped onto model entities by GlobalId. Writes: measured-vs-predicted deltas as
channels/facts; issues when measured performance departs from the design-stage analysis
that justified a decision. Cadence: continuous (the only genuinely continuous entry
here). Trust: T2 for data landing, T1 for interpretation. This closes the
post-occupancy loop from the governance doc §9 — and it is the entry that most stresses
the architecture, because everything else in the platform is batch/checkpoint-shaped.
Honest note: probably V4-era; listed to make sure nothing in the agent model precludes
a continuous reader.

### 1.3 Coordination and knowledge agents

**Discipline negotiator (arch vs MEP vs structure).** Reads: two design options or two
discipline models, the interface agreements, the decision records in tension. Writes:
a structured statement of the conflict (which requirements collide, what each side's
constraint costs the other), candidate resolutions as *option workspaces*, never a
resolution itself. Cadence: triggered by coordination issues or clash results. Trust:
T1, emphatically — "negotiator" is a misnomer for what it should be, which is a
*briefer*: it makes the trade-off legible and drafts the options; humans negotiate.
An agent that actually horse-trades floor-to-floor height for duct space is a T3
fantasy that would launder responsibility.

**Librarian.** Reads: the graph/workflow library, subgraph usage across projects, the
firm knowledge base (§10 of the governance doc). Writes: curation proposals — "these
four carbon graphs are near-duplicates, here is a parameterized merge," deprecation
flags, missing-documentation issues, tags. Cadence: scheduled, low frequency. Trust:
T1. The librarian is how the workflow library avoids the fate of every firm's
`Standards/` folder.

**Teacher / explainer.** Reads: a graph, its evaluated values, the docs. Writes: prose —
"this graph selects doors, joins the rates table on Type, and the amber warning means
14 rows didn't match." Cadence: interactive. Trust: T0, the only pure-T0 standing role
worth naming. Cheap because of P1: the graph JSON plus wire values *is* the explanation
substrate. Also the natural on-ramp: novices meet agents first as explainers, and trust
built there transfers.

**FM concierge.** Reads: the handover world model — asset registers, warranties,
maintenance zones, `ai.ask` over the enriched scene. Writes: answers, and draft work
orders / issues when an answer implies action ("that AHU's warranty expired"). Cadence:
interactive, long-lived deployment. Trust: T0 answers, T1 drafts. This is `ai.ask`
wearing a persona and a jurisdiction — evidence that the resident-node and the
standing-role forms are ends of one spectrum, not different species.

**Scheduler / procurement checker / spec-vs-model checker.** Same shape as the
auditor family: read the model plus an external structured source (construction
schedule, procurement register, spec sections), run comparison graphs, file
discrepancy verdicts and issues. Trust: T2 execution, T1 interpretation. Listed
together because they demonstrate that the taxonomy compresses: by this point every
new "agent idea" is (external table) + (join graph) + (rule nodes) + (issue-filing
policy) + (a mandate document). That compression is the design finding.

### 1.4 What the taxonomy compresses to

Fifteen-plus roles, but only **four mechanical shapes**:

| Shape | Where it lives | What it emits | Trust ceiling |
|---|---|---|---|
| **Resident node** | inside a graph, evaluated | one typed wire value | T0/T1, bounded by sockets |
| **Session copilot** | beside a human, via MCP | Intents into the open session | T1, reviewed by Ctrl-Z and eyes |
| **Standing watcher** | above graphs, headless | runs of approved graphs; issues, reports, verdict filings | T2 execution + T1 prose |
| **Standing author** | above artifacts, headless or interactive | draft artifacts (graphs, rules, estimates, briefs) + proposals | T1 always |

Every role above is one of these, or a watcher and an author stapled together (the
compliance reviewer runs approved graphs *and* drafts the RFI letter). The platform
should build the four shapes, not the fifteen roles — the roles are configuration.

---

## 2. Dimensions along which agents differ

The design space, as axes rather than instances. An agent definition (§3) is a point
in this space, and the axes are what its definition file must be able to express.

**Mandate / scope.** What the agent is *for*, stated narrowly: which models, which
disciplines, which code editions, which portfolio slice. A mandate is also a refusal
list — the energy-analysis agent that must not touch the architectural model
(governance doc §8). Scope should bind to the same vocabulary the platform already has:
model ids, graph library paths, rule-library editions, WorkQuarry areas.

**Autonomy: propose vs act.** The T-levels above, but per *capability*, not per agent:
one agent may be T2 for "run graph X and file its verdicts" and T1 for "modify graph
X." The permission verbs from the governance doc (read / analyse / propose / modify
working artefacts / approve / publish / issue) are the right granularity. Approve,
publish, and issue are human-only verbs, permanently; the interesting design freedom
is entirely inside read→modify.

**Evidence obligations.** What the agent must attach before its output counts:
artefacts-inspected list, semantic diffs, checks run, citations. The compliance track
sets the ceiling (every verdict carries rule id + citation + evidence); the copilot
sets the floor (the selected subgraph is its own evidence). Rule of thumb worth
adopting: **evidence obligation scales with output lifetime.** A chat answer needs a
query citation; a rule draft needs a corpus run; anything written to the project
record needs the full 9-step proposal.

**Determinism boundary placement.** Where LLM judgment is allowed vs where only
replayable execution counts. The platform's line is already drawn — LLMs produce data
and drafts, deterministic execution produces verdicts — but each agent shape draws it
at a different altitude: the resident node's judgment is confined to one param-filling
act (write the SQL); the watcher's to notification prose; the author's to the entire
draft, with determinism deferred to the approval gate. The invariant across all of
them: **the replayable artifact is the product; the LLM contribution is either
parameter-filling or draft-making, and the system can always tell which.**

**Identity and accountability.** The ledger question. Every material agent action
should record: agent identity (name + definition version), model + version, skill/
instructions version, the human principal on whose behalf it ran, input artifact
versions (content hashes), tools called, tokens/cost, and disposition. This is the
governance doc's AI-provenance list, and WorkQuarry frontmatter is a plausible
carrier: an agent *run* is a dated record file the way a decision is. Two identities
must never blur: the agent (a versioned definition) and the principal (a person whose
professional responsibility the output ultimately rides on). "Claude via Christopher"
is the Slack-comment pattern, and it is the right pattern here too.

**Lifecycle.** Ephemeral session agent (the copilot dies with the session; its residue
is the graph and the undo stack) vs standing role (the auditor persists across model
versions and accumulates a run history; its residue is the ledger). Standing roles need
versioned definitions, deprecation, and handover — exactly the lifecycle rules the
rule IR already has (immutable once approved; change = supersede). Ephemeral agents
need almost nothing, which is an argument for pushing work toward ephemerality
wherever the cadence allows.

**Locus.** Inside a graph (node), beside a graph (session copilot via MCP), above
graphs (orchestrating runs of many). The locus determines the natural review surface:
node → the wire value and shown SQL; session → the canvas selection; above → the
proposal record and the diff. A fourth locus — *between* projects (the librarian,
the portfolio scanner) — reads many repos and writes to a shared library, and is the
only one whose review surface doesn't exist yet.

**Memory.** Deliberately last, because the platform position should be: **agents have
no private memory.** What an agent "knows" is what the ledger, the graph library, the
decision records, and the knowledge base say. An agent that learned something worth
keeping files it (an issue, a decision draft, a library annotation) or it evaporates —
see §4. Private agent state is where provenance goes to die.

---

## 3. How people design agents: candidate surfaces, and a position

### 3.1 The candidate design surfaces

**Agent-as-skill-file.** A markdown file: mandate prose, step discipline, tool
allowlist, refusal list. Git-versioned, diffable, reviewable in a PR like any code.
Precedent is everywhere (Claude Code skills, WorkQuarry's elaboration skills, the
`AGENTS.md` convention). Strength: prose is the right medium for judgment guidance —
"prefer InfoNotAvailable over guessing," "always show the unmatched-row count."
Weakness: prose is not executable, so a skill file alone cannot make an agent's
*behavior* replayable — two runs of the same skill file diverge.

**Agent-as-graph.** A saved PlatoFlow graph IS the agent's deterministic body: the
auditor is literally a set of QA graphs plus a trigger; the estimator is a takeoff
graph with promoted parameters; the LLM's role collapses to filling graph parameters
and writing the summary. Strength: the body is replayable, diffable, testable with the
headless harness — the entire P4 discipline applies to the agent for free. Weakness:
graphs cannot express mandate, tone, escalation policy, or when *not* to run; and
authoring agents (the copilot, the encoder) do their interesting work *outside* any
one graph.

**Agent-as-persona-config.** A structured record: name, jurisdiction, code editions,
units, model/version pin, cost budget, notification policy. Strength: machine-checkable
(the platform can *enforce* "NBC-2020 only"); the right home for everything that is a
value rather than a sentence. Weakness: configs metastasize; a config-only agent
design ends with a 200-field form that encodes prose badly.

**Agent-as-checklist.** The 9-step proposal protocol as a literal form the agent must
fill: interpretation, assumptions, artefacts inspected (with hashes), changes, diffs,
checks, risks, review request, disposition. Strength: this is the accountability
skeleton, and making it a *schema* rather than a habit means the platform can reject
an incomplete proposal mechanically. Weakness: it defines the output contract, not
the agent — every agent shares it.

**No-code agent builder.** A wizard assembling the above. Defer: it is a *view* over
whichever representation wins, and building the view before the representation is the
mistake P1 exists to prevent.

**Agent-as-code.** Arbitrary scripts with MCP access. This is what an agent *is* at
the implementation layer, but as a user-facing design surface it abandons
reviewability for everyone except programmers, and the platform's whole bet is that
the reviewable artifacts (graphs, rules, records) sit above code.

### 3.2 Position: the unit of agent definition is a versioned bundle, and the graph is the body

None of the surfaces wins alone because they answer different questions, so the honest
design is a small **bundle** — a directory in git, WorkQuarry-style:

```
agents/carbon-auditor/
  agent.md          # mandate, judgment guidance, escalation policy (the skill file)
  agent.yaml        # persona config: scope bindings, code editions, model pin,
                    #   tool allowlist, trust grants per capability (the enforceable part)
  graphs/           # or references into the shared library: the deterministic body
  runs/             # dated run records: 9-step proposals, hashes, dispositions (the ledger)
```

With four rules that keep the git-native discipline the ecosystem already has:

1. **The graph is the body; the prose is the steering.** Any agent action that touches
   the project record must be expressible as: ran graph G (version v, inputs hashed)
   and/or proposed diff D. The LLM chooses *which* graph, fills *parameters*, and
   writes *prose around* the results — it never is the mechanism of record. This
   extends the deterministic boundary from compliance to agency in general, and it is
   the position this document argues hardest for: it is what makes an agent's work
   auditable by the same harness that audits everything else.
2. **The config is enforced, the prose is trusted-but-versioned.** `agent.yaml` binds
   to the permission system (the platform refuses an out-of-scope Intent mechanically);
   `agent.md` shapes behavior but its violation is a review finding, not a crash.
   Putting a constraint in the right file is a design act: if it can be enforced, it
   goes in the config.
3. **The proposal protocol is platform machinery, not agent content.** Every bundle
   gets the 9-step schema for free; an agent definition never restates it, and a run
   record missing a step is mechanically incomplete.
4. **Changing an agent is a diff.** Definition changes are commits with rationale
   (the design-principles file's own amendment rule); a standing agent's behavior
   change without a definition diff is, by definition, model drift — which is why the
   config pins the model and the run record logs it.

This bundle degrades gracefully across the four shapes of §1.4: a resident node's
"bundle" is just its node params (the SQL prompt is provenance already); a session
copilot needs only `agent.md` + allowlist; watchers and authors use the whole thing.
One representation, four weights.

---

## 4. Failure modes and governance

**Hallucinated compliance.** The flagship risk: an agent asserts a building passes.
Mitigation is structural and already designed — the LLM cannot emit a verdict.
`verdict.fromTable` validates enum strings and rejects rather than coerces; rules
execute deterministically or not at all; `Uncertain` routes to humans by rule
metadata. The residual risk is *prose* laundering: an agent's summary saying "broadly
compliant" over a verdict table that says 7 Fail. Governance: summaries that
accompany verdict streams must embed the per-category counts mechanically (the
`view.verdicts` chips are the template), and review UIs show the numbers beside the
prose, never the prose alone.

**Stale-plan re-execution.** A standing agent re-runs against a model that changed
meaning, or runs a graph whose source CSV moved under it. Mitigation: the platform
already hashes sources (stale badges, memo invalidation); agent runs must record
input content hashes, and a T2 grant is conditioned on hash match — an unexpected
hash demotes the run to T1 (file a proposal, don't act). The auditor noticing "the
model changed shape, not just content" is the data steward's job; chaining the
steward before other watchers is a scheduling pattern worth making default.

**Evaporated observations.** An agent notices something real — a suspicious null
group, an undocumented grid change — and it dies in a chat transcript. Mitigation:
the no-private-memory rule (§2) plus a cheap capture path: any observation worth
keeping becomes a WorkQuarry item or a draft decision record, in the same gesture
that produced it. The governance doc's "detect likely undocumented decisions" is
this pattern; the platform should make filing cheaper than mentioning.

**Agents colliding on shared state.** Two agents (or an agent and a human) editing
one graph or one model concurrently. Mitigation: the reducer is a serialization
point per session, and everything above session scope goes through proposals —
which are branches, and branches don't collide, they merge under review. Standing
agents therefore never write to a shared working artifact directly; they write to
their own run records and file proposals. The one genuinely shared surface left is
the issue tracker, where duplicate filings are a nuisance, not a corruption — the
librarian dedupes.

**Privilege creep.** A useful T1 agent gets waved through so often that someone
grants it T2 over authoring, and now drafts are landing unreviewed. Mitigation:
trust grants live in `agent.yaml` per capability, changing one is a reviewed commit,
and the approve/publish/issue verbs are not grantable to agents at all. The ledger
makes creep visible: run records show disposition rates, and "100% accepted without
edits for six months" is an argument for promoting the *graph* to a T2 watcher —
not for promoting the author.

**Cost and cadence runaway.** Continuous and scheduled agents multiply quietly.
Mitigation: budget in the config, cost in the run record, and the portfolio-level
question "what did agents cost this month, per role" is a `table.aggregate` over the
ledger — the platform's own tools audit its agents.

**Provenance laundering through reuse.** An estimate drafted by an agent on project
A gets copied into project B as if it were reviewed fact. Mitigation: the governance
doc's reuse rule (every reused item keeps its source and is revalidated) plus the
draft/approved status field traveling *with* the artifact, as rule IR already does.
Status is part of the object, never part of the folder it sits in.

---

## 5. Strawman: the V1 agent

The minimal agent worth shipping first is the **session-scoped graph-authoring
copilot with a mandate file** — the P3 agent, plus exactly two new things: a named,
versioned `agent.md` it runs under, and a run record it leaves behind.

Concretely: a user opens a session and invokes "carbon-audit assistant." The agent
reads its mandate (scope: this model; prefer library subgraphs; always show
unmatched-join counts; never touch sink nodes' Run buttons), authors a QA graph
through ordinary Intents (workflow 52 in the V1 node doc — assembling audits 1–7),
evaluates it, and reads the verdict outputs. The human reviews *the graph* — selected
on canvas, undoable — and the session leaves a run record: mandate version, model
hash, graph produced, verdict counts, disposition. No standing processes, no
schedulers, no new trust machinery: T1 end to end, with the reducer as the only gate.

Why this one: it exercises the bundle format at its lightest weight, produces the
artifacts the heavier agents will need (mandates, run records), requires zero
capabilities beyond the V0 MCP surface plus V1 nodes, and its output — a reviewable
graph — is already the thing the platform trusts. The background auditor is then a
V2 delta (batch runner + trigger + T2 grant over the graphs this copilot's sessions
produced and humans approved), not a new design.

### Open questions

1. **Where do bundles live?** Per-project (`project/agents/`), per-user (the
   WorkQuarry per-user ledger), or a firm-level library with project pins — and what
   does "this project uses carbon-auditor v3" look like in the project record?
2. **Is the run record a WorkQuarry item?** The frontmatter fits (date, links,
   status-as-disposition), but runs are append-only telemetry while items are living
   documents; forcing one schema over both may distort each. Decide before the first
   ledger accumulates.
3. **Model pinning vs model drift.** Pinning model+version makes runs comparable but
   ages the agent; floating keeps it current but breaks "same definition, same
   behavior." Is the answer per-trust-level (T2 pins, T1 floats)?
4. **How does a mandate bind to scope mechanically?** `agent.yaml` needs a scope
   vocabulary (model ids? graph-library paths? WorkQuarry areas?) that the permission
   layer can actually check — this vocabulary doesn't exist yet anywhere.
5. **Agent-to-agent composition.** The steward-before-auditor chaining, or the
   copilot invoking `ai.ask` — are these orchestrations recorded as one run or a
   tree of runs, and who is the principal of a spawned run?
6. **The disposition loop as training signal.** Run records accumulate
   accepted/edited/rejected outcomes per mandate version. Do we ever close this loop
   automatically (suggesting mandate edits), or is that itself an author-agent (a
   mandate librarian) filing proposals?
7. **What does the *user* call these?** "Agent" is the implementation word; the
   governance doc's personas suggest users will want role words (reviewer, assistant,
   auditor). Naming in the UI shapes trust expectations — a "copilot" being wrong is
   forgivable; an "auditor" being wrong is a scandal. Choose vocabulary with the
   trust levels in mind.
8. **Does the resident node family grow toward agency?** `ai.ask` today is one call,
   one value. A future node that iterates (ask, inspect, re-ask) inside evaluation
   would blur the node/copilot line and complicate memoization and determinism.
   Decide the ceiling for in-graph agency before someone builds past it.
