# PlatoFlow × IFC — compliance design (V3): automated code checking

> **AI-assisted design document** (Claude + Christopher Diggins, 2026-08-09).
> Companion to `platoflow-ifc-design.md` (the core platform) and governed by
> `platoflow-design-principles.md`. Addresses the NRC research challenge on automated
> building-code compliance checking (NBC Part 3 / Part 9) as a **V3 track** on the same
> platform — after V0 (alpha), V1 (MVP), V2 (rich experience).
>
> One revision defined here applies to the core platform **immediately**: the
> five-category verdict system (§2). Everything else is V3 scope.

## 1. Framing: a third track on the same platform, not a separate system

The challenge decomposes into three artifacts:

1. **Digitalized code** — RASE-annotated XML/DITA, JSON-LD, RDF/TTL ontologies (input;
   formats set by the challenge, sample data optionally from NRC).
2. **An executable rule IR** (intermediate representation) — *the contract*, and the most
   important design artifact in this document (§3).
3. **The execution engine** — PlatoFlow's headless evaluator plus checker nodes,
   unchanged in kind from the core design.

Rule *authoring* (AI drafts rules from code text; experts verify, edit, approve;
versioned libraries per code edition) is a **separate subsystem with a separate user**
(code experts, not practitioners) and a separate lifecycle (authored once per edition,
executed per project). It shares the platform through three things it must never fork:
the rule IR, the verdict semantics (§2), and the fact vocabulary (§4). The seam is the
design; the two surfaces are apps on either side of it.

Roughly 70% of the challenge's mandatory outcomes land on things the platform already
designed or has built once:

| Mandatory outcome | Platform answer |
|---|---|
| Deterministic component, machine-executable rules, repeatability | Door-clearance precedent (`ara3d-sdk/tests/Ara3D.DoorClearance.Tests`): rules with citations, applicability, deterministic sorted output, SHA-256'd reports. Principle P4 makes determinism a standing obligation |
| Traceability / auditability with code-provision references | Channel + verdict provenance; citations carried on every verdict; Pset writeback of verdicts and overrides (proven byte-identical) |
| Open API for programmatic queries and workflow initiation | The P3 MCP surface — already V0 |
| Human-in-the-loop | The graph is a human-in-the-loop surface: display flags, verdict-colored 3D, overrides as ordinary undoable Intents |
| Hybrid deterministic + probabilistic | §5's boundary rule: probabilistic components produce *facts* and *drafts*; only deterministic execution over approved rules issues verdicts |
| Itemized four-category results | §2 (revised to five, mapping cleanly onto the required four) |
| Intuitive UI for practitioners/officials | §6 review surfaces; officials get workflows-as-documents, not raw node editing |

The genuinely new investments: the rule IR (§3), the facts pipeline for drawings and
permit documents (§4), and the review/authoring UX (§6).

## 2. Verdict semantics: five categories (core-platform revision, effective now)

The challenge requires four categories: Pass / Fail / Information-Not-Available /
Uncertain. The door-clearance precedent used four different ones: Pass / Fail /
NotApplicable / Inconclusive. Neither four-set is right; the union minus the vague one is:

| Verdict | Meaning | How it is produced |
|---|---|---|
| `Pass` | Provision met | Deterministic rule evaluation |
| `Fail` | Provision not met | Deterministic rule evaluation |
| `NotApplicable` | Provision does not apply to this element/building | Deterministic applicability filter (classification, typology, storey, occupancy). Indispensable for NBC — most of Part 3/9 is applicability logic |
| `InfoNotAvailable` | A fact the rule requires is absent from the model, drawings, or permit data | **Mechanically derived**: fact lookup failed. Carries *what* was looked for and *where* (the request-for-information letter writes itself) |
| `Uncertain` | Determination withheld — not for lack of data but because the rule is flagged as interpretive, site-specific, or a critical health/safety provision requiring case-by-case human assessment | Rule metadata (`uncertainty: interpretive \| siteSpecific \| criticalHS`) or a probabilistic flag; always routes to human review |

`Inconclusive` is retired: it conflated the last two, which have opposite remedies
(supply data vs. exercise judgment). Reporting to the challenge's four categories is a
projection: `NotApplicable` reports as its own line or folds into scoping, per NRC's
preference.

This enum is defined in the **core** `verdicts` wire type now (V1), even though only V3
populates all five — retrofitting verdict semantics after graphs and psets exist in the
wild is exactly the kind of surgery P5 forbids.

## 3. The rule subsystem

### 3.1 The rule IR

Rules are **data, not code and not graphs**. The door-clearance `rules.json` is the
embryo; the IR grows it to:

```jsonc
{
  "id": "NBC-9.5.3.1-a",
  "edition": "NBC-2020",
  "citation": { "code": "NBC", "clause": "9.5.3.1.(1)", "text": "…" },
  "source": { "format": "RASE", "ref": "…" },        // link back to digitalized code
  "applicability": {                                  // → NotApplicable
    "classification": ["Part9.House", "Part9.SecondarySuite"],
    "entityType": "IfcDoor", "predicate": { … }
  },
  "requires": ["door.clearWidth", "door.storey"],     // fact vocabulary refs → InfoNotAvailable
  "requirement": { "kind": "threshold", "expr": { … } },
  "uncertainty": null,                                // or interpretive | siteSpecific | criticalHS
  "status": "approved",                               // draft | approved | deprecated
  "provenance": { "draftedBy": "ai|human", "approvedBy": "…", "testedAgainst": ["corpus/…"] }
}
```

Design rules:

- **Requirement expressions are a small, closed, deterministic language** (comparisons,
  arithmetic, boolean logic, quantifiers over fact sets) — total, terminating, no IO.
  Everything effectful or probabilistic happens *before* rule evaluation, in fact
  production.
- **Rules reference facts by name only** (§4). The IR never touches IFC directly; the
  fact vocabulary is the abstraction that lets the same rule check a BIM model, a
  drawing extraction, or both.
- **Ingestion from digitalized code formats** (RASE/DITA XML, JSON-LD, TTL) is a set of
  compilers *into* the IR, not alternative execution paths. RASE's
  Requirement/Applicability/Selection/Exception structure maps almost 1:1 onto the IR's
  applicability/requirement split — start there.
- **Versioned libraries per code edition**; rules are immutable once approved (a change
  is a new rule superseding the old — audit trails require it).

### 3.2 Rules-as-data, expanded into graphs for verification

Hand-wiring hundreds of Part 9 provisions as subgraphs will not scale; the IR is
diffable, generatable, and testable. But PlatoFlow gets a unique auditability move:
**"open this rule as a graph"** — expand any rule's IR into Select → Derive → Compare →
Verdict nodes so an expert can trace any verdict through live data with display flags.
Canonical form: the IR. Human-verification view: the expansion. This is the platform's
differentiator; no mainstream compliance tool can show a regulator *the dataflow* behind
a verdict.

### 3.3 Classification is a step, not an assumption

NBC applicability starts with what the building *is*: Part 3 vs Part 9, the 3.2.2 major
occupancy classification, Part 9 typology (single vs multiple dwelling, secondary suite,
…). So `Classify` is an explicit node whose output (a `classification` value) gates
ruleset selection — and classification itself is reviewable: it renders as a verdict-like
determination with the evidence that produced it, overridable by the official. A wrong
classification silently invalidates every downstream verdict; making it visible and
contestable is a requirement, not a nicety.

### 3.4 Rule approval = golden tests

An expert "approving" a rule concretely means: the rule runs against a **reference corpus**
of models/documents with known-correct verdicts, deterministically, and the results match.
The corpus is versioned next to the rule library; P4's headless harness *is* the
rule-verification engine, and P3's MCP surface is how authoring-side agents run it.

## 4. Facts: the second data plane (documents and drawings)

The core platform flows scenes derived from BOS. Compliance adds sources that are not
models: 2D drawings (PDF/CAD) and structured/unstructured permit-application data. These
produce **facts**, a new value type:

```
Fact = { subject,           // element GlobalId, space, storey, or the building
         name,              // from the fact vocabulary, e.g. "door.clearWidth"
         value, unit,
         confidence,        // 1.0 for model-derived; <1 for extracted
         provenance }       // { source: "model" | doc, page?, region?, extractor? }
```

- **Model-derived facts** are computed deterministically from the scene (Derive nodes
  already do this; a thin adapter projects channels into the fact vocabulary).
- **Extracted facts** come from a vision-LLM extraction service on the sidecar
  (probabilistic), each carrying document/page/region provenance. Extraction failure is
  where `InfoNotAvailable` originates.
- **The fact vocabulary is a registry** (P2): named, typed, unit-carrying definitions
  that rules cite in `requires`. It is the shared language between the model plane, the
  document plane, and the rule IR.
- **Cross-checking falls out**: drawing-extracted facts vs model-derived facts for the
  same subject and name, discrepancies surfaced as verdicts. This drawing↔model
  consistency check is a workflow competitors rarely demo.

New Source nodes: `LoadDrawings` (PDF; CAD later), `LoadPermit`, `ExtractFacts` (config:
which vocabulary entries to look for). All V3.

## 5. The deterministic/probabilistic boundary (the trust story)

One sentence, enforced structurally: **probabilistic components may only produce facts
(with confidence and provenance) and rule drafts (with `status: draft`); every verdict is
issued by deterministic execution of approved rules over stated facts.**

Consequences:

- The AI never grades. Re-running a check with the same rule library and the same facts
  yields byte-identical results (P4 determinism), which is the challenge's
  "consistency, accuracy, repeatability" requirement made literal.
- Low-confidence facts don't soften verdicts; a confidence threshold per rule either
  admits the fact or yields `InfoNotAvailable` ("legible below threshold" is not data).
- `Uncertain` is declared in rule metadata by humans (or proposed by AI during drafting
  and confirmed at approval) — it is a property of the *provision*, not a model mood.

## 6. Human-in-the-loop surfaces

Three, for three roles:

1. **Verdict review pane** (practitioner/official): itemized checklist, filter by
   category/storey/rule; click a verdict → element highlighted in 3D, citation, evidence
   chain (facts used, with provenance — down to the drawing region), override with
   mandatory reason. Overrides are ordinary Intents (undoable, attributed) and write back
   as psets (`Ara3D_Compliance`, proven pattern).
2. **Rule authoring surface** (code expert): side-by-side code text (RASE-annotated) ↔
   IR ↔ graph expansion (§3.2); AI-draft button; corpus test results inline; approve /
   request-changes. This is the "AI converts code into formal checks, verified and edited
   by human experts" loop, made concrete.
3. **Report sink**: itemized permit-style report (HTML/PDF) — verdicts grouped by
   provision, citations, evidence, override log, rule-library version, and the run hash.
   Officials who never open the node editor consume this plus workflow-as-document runs
   via the MCP/API surface.

## 7. Workflows

1. **Permit check** — LoadIFC + LoadDrawings + LoadPermit → ExtractFacts →
   Classify → SelectRuleset(edition, classification) → ApplyRules → review pane +
   verdict heat-map (categorical ColorBy) → overrides → Report + WritePset.
2. **Rule authoring** — code clause (RASE) → AI-drafted IR → expert side-by-side review →
   corpus regression run → approve into versioned library.
3. **Missing-information intake** — run checks at permit intake; the `InfoNotAvailable`
   list, with its what-and-where provenance, *is* the request-for-information letter.
4. **Drawing↔model consistency** — extracted vs derived facts, discrepancies as verdicts.

## 8. V3 staging and what touches the core earlier

**Effective immediately (core, V1):** the five-category verdict enum in the `verdicts`
wire type (§2). **V2 seed:** a single-ruleset `RuleCheck` node executing hand-authored IR
against model-derived facts only — the door-clearance demo re-homed onto the platform,
and the proving ground for the IR.

**V3.0 — rule execution at NBC scale.** IR finalized; RASE/DITA/TTL ingestion compilers;
`Classify` + `SelectRuleset` + `ApplyRules` nodes; fact vocabulary registry with
model-derived facts; verdict review pane; report sink. IFC-only (no drawings yet).

**V3.1 — authoring.** Rule authoring surface; AI drafting; reference corpus + golden
approval workflow; rule library versioning; graph expansion of rules.

**V3.2 — documents.** PDF drawing + permit ingestion; extraction service; extracted
facts with provenance; drawing↔model cross-check; `InfoNotAvailable` intake workflow.
(CAD file support: only if the engagement demands it; PDF-first.)

Ordering rationale: execution before authoring (you cannot verify authored rules without
the engine and corpus harness), authoring before documents (document extraction is the
riskiest, most probabilistic piece — it should land on a stable, well-tested rule engine,
and V3.0+V3.1 already satisfy the challenge's deterministic-component and
human-in-the-loop essentials on BIM inputs).

## 9. Open questions

- IR expression language: adopt/adapt an existing encoding (e.g. RASE-derived logic,
  LegalRuleML fragments) vs a minimal home-grown closed language. Leaning minimal +
  compilers in, but survey first.
- Fact vocabulary governance: how entries are named/versioned, and their mapping to
  classification systems (Uniformat/Omniclass) and IFC data-dictionary objects — the
  challenge names these mappings explicitly.
- Quantifier scope in requirements ("every door on an egress path…"): how much path/graph
  reasoning the closed language needs vs precomputing as facts (egress paths as derived
  facts keeps the language small; leaning that way).
- Confidence thresholds: global, per-vocabulary-entry, or per-rule.
- Whether `Classify` outputs feed the core `groups` mechanism (classification as a
  GroupBy) or stay a distinct value type.
