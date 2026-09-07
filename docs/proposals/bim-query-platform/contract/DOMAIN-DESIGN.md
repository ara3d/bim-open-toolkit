# Choosing useful domain models without building another IFC

The earlier concept inventory covered the territory, but it did not establish which concrete models deserved attention first. The next step is a **workflow-driven design backlog**, with a small active queue. A list of building nouns is not enough: each proposal must explain a user's decision, the row meaning, the minimum useful fields, and why a separate model improves the answer.

Start with the generated [review queue](DOMAIN-QUEUE.md). Explore the full [hierarchical JSON](domain-models.json) for questions, field sketches, user/workflow tags and priority rationales. These are proposals for the next semantic design iterations, not additional approved C# records.

## Organize for discovery, not inheritance

The hierarchy is **domain → practical concept group → proposal**. Each proposal has one home, plus tags and links to multiple roles and workflows. A material model can support estimating, structural design and carbon reporting without becoming three different material identities. The domain hierarchy does not generate base classes or require every object to fit a deep taxonomy.

Four forms keep the brainstorm from becoming a class explosion:

| Form | When it is appropriate | What would be a mistake |
|---|---|---|
| Record | Users repeatedly need a distinct row meaning and stable fields or relationships | A separate record for every product label, IFC subtype or trade name |
| Facet | A useful group of fields applies to several existing kinds of object | Copying the same maintenance or access fields into every equipment subtype |
| View | Users need a schedule, comparison or grouped answer derived from shared facts | Creating a second independent truth for an object's quantities or status |
| Capability | The need is traversal, geometric analysis or another computation with explicit inputs/results | Pretending that a table named after an algorithm implements that behavior |

“Fixed model” means predictable meanings, fields and relationships. It does not require complete data. Typed domain records must retain unknown values, ambiguous associations and competing evidence just as the shared foundation does.

## How priority is assigned

The [review policy](domain-review-policy.json) contains the rating definitions, a complete decision matrix and the active design selections. Ratings concern **incremental value over the current contract**, not the importance of a profession or its work. They are editorial hypotheses grounded in the current workflow catalog and synthetic examples, not interview findings, measured frequency, market demand or verified source readiness.

| Decision impact | Frequent use hypothesis | Occasional use hypothesis | Rare use hypothesis |
|---|---|---|---|
| High: fills a practical typed-domain gap that still requires ad hoc reconstruction | High value | Medium value | Medium value |
| Medium: extends or presents an answer substantially supported already | Medium value | Medium value | Low value |
| Low: reuse largely suffices, or added detail has no demonstrated near-term gap | Low value | Low value | Low value |

This deliberately gives an **ordinal review band**, not an invented ROI number. The consequence of getting a safety or accessibility answer wrong can outweigh frequency; high-impact rare cases are never automatically low value and warrant an explicit review. The matrix is a starting rule that can be challenged with a concrete example.

Three other dimensions stay separate:

- **Scope cost:** a valuable but difficult topology or performance problem stays valuable. It may require investigation before design or implementation.
- **Evidence basis:** a proposal connected to a worked workflow has a stronger starting question than a fresh brainstorm. Each such claim names an exact scenario, the aspect it supports, and what it does not establish. Neither label proves the proposed record has been validated against real BOS data.
- **Next action:** a maximum of eight proposals enter the active semantic design wave. Other proposals may reuse a view, extend an existing contract, await validation, or be parked. These are review actions, not delivery dates or implementation commitments.

Role and workflow counts do not affect the band. Broad tagging is easy to inflate and would systematically favor generic infrastructure. Cross-trade coverage instead informs the explicitly justified active selection. Dependencies and shared existing primitives can support an active slice without becoming dozens of new active models.

The initial scoring produced 33 high-value proposals because it mostly measured workflow importance. Independent review exposed that inflation. The revised queue makes current-contract fit inspectable: `work_package` starts from `work_packages`, `finish_surface` from `finish_schedule`, and assessment/impact results reuse the existing result grains. Their new-model priority can be lower even while their workflows remain essential. Unreviewed fit is labeled `unassessed`, not silently assumed to require a new table.

For example, electrical panel supply/circuit fields fill a typed-domain gap; a second assessment-results record largely duplicates the present `assessments` contract. Detailed acoustic response is parked for the initial scope because it lacks a worked scenario and needs substantial domain inputs, not because acoustic engineering is unimportant. Finish-surface design remains active at medium incremental value to test whether better naming and a small extension of the existing record suffice.

## How we challenge a candidate

For each active proposal:

1. Work through its named user's question. Show the answer using the current generic representation and then the proposed model. Identify what becomes simpler or less error-prone.
2. Construct a complete and an incomplete example. Include a realistic trap: duplicated source objects, room associations, incompatible quantity bases, missing connectors or absent rates.
3. Test its proposed boundary. Could a subtype label, shared facet or existing table view serve the question? If so, merge or reclassify the proposal.
4. Review each proposed field against a question. Keep rare source details accessible as evidence rather than adding every possible property to a permanent record.
5. Trace actual examples from the more reliable Revit-derived corpus, while separately testing imperfect IFC exports. Source omissions create explicit gaps; they do not determine whether the domain concept matters.
6. Once the row meaning and fields are accepted, define the actual JSON row shape, keys, examples and generated C# view. Evaluate storage/query costs when the slice has a meaningful source mapping.

The `separateBecause` and `mergeOrDefer` text is mandatory. It records both the case for a proposal and the case against a separate model. Promotion is a domain decision supported by examples, not a consequence of reaching a score threshold.

Compare competing proposals directly when the queue is crowded: which named decision is blocked today, what minimum information unblocks it, and which proposal contributes more to the next contrasting workflow example? Replace an active item rather than continually increasing the active budget.

## Authoring and mechanical checks

| File | Responsibility |
|---|---|
| [domain-candidates.csv](domain-candidates.csv) | Compact editable candidate inventory, questions, sketches, ratings and rationales |
| [domain-review-policy.json](domain-review-policy.json) | Rubric, value matrix, existing-contract fit, exact scenario support, guardrails and bounded active selection |
| [domains.csv](domains.csv) and [workflows.json](workflows.json) | Existing domain, user and workflow identifiers; the backlog references these rather than creating competing catalogs |
| [domain-models.json](domain-models.json) | Generated hierarchical view with tags and derived priority bands |
| [domain-models.schema.json](domain-models.schema.json) | Structural contract for the design-backlog document; not a schema for building rows |
| [DOMAIN-QUEUE.md](DOMAIN-QUEUE.md) | Generated compact review view |
| [build_domain_backlog.py](build_domain_backlog.py) | Standard-library builder and cross-catalog checks |

`group` is a navigation label. Proposed fields and relationship sketches are brainstorming inputs, not finalized column names, units or foreign keys. New questions can link broader existing workflows, but that does not mean those workflow contracts already satisfy the question.

Regenerate from the repository root:

```powershell
python docs/proposals/bim-query-platform/contract/build_domain_backlog.py
python docs/proposals/bim-query-platform/contract/build_domain_backlog.py --check
```

The builder checks unique IDs, domain/role/workflow references, current-table and exact-scenario references, required decision/grain/field sketches, evidence labels, the priority matrix and the active budget. Tests additionally validate the JSON shape and verify that expensive work retains its value, extra role tags do not inflate priority, and rare high-impact work is not demoted to low value. Run the `DomainDesignSmallReviewTests` category using the existing review-test environment:

```powershell
./artifacts/bim-contract-review-venv/Scripts/python.exe -m unittest discover -s docs/proposals/bim-query-platform/contract/tests -k DomainDesign -v
```

The backlog is intentionally not an input to `generate_records.py`. Adding a brainstormed candidate must not silently add a class. The present 23-table C# view remains a review projection of the existing row contracts; the new queue determines which missing domain models to define and challenge next.
