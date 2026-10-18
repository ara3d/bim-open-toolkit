# Ticket review, 2026-10-17

A fresh reading of every open ticket (178 of them; none was claimed or blocked on this date) against `PROJECT.md` (the brief), `AGENTS.md`, the platonic-coder `PRINCIPLES.md`, `docs/CANDIDATE-WORK.md` and `docs/OVERVIEW.md`, and, for the STEP tickets, `sandbox/step-brep-mesh/` and `docs/plans/step-reader.md`. Commissioned under TKT-299. "W1" to "W5" are the five workflows of `PROJECT.md`; "the Done line" of a workflow is the sentence beginning "Done:" in that workflow's paragraph. Facts checked against the checkout on 2026-10-17 say so.

## Summary

The list is long, old in places, and pointed at the wrong things. Of 178 open tickets, 50 would move a Done line or a success line if their acceptance were met, several only in part; the rest are debts, polish, kept-scope work, or work no workflow names. Three structural problems run through it. First, the repository split of 2026-10-03 moved the flow, host, MCP and web packages into `deps/bim-open-flow` and the data code into `deps/bim-open-data`, and 30 tickets still fence paths that no longer exist here (TKT-12, TKT-26, TKT-33, TKT-47 and TKT-123 have every or nearly every fence path stale). Second, the brief was rewritten on 2026-10-04 to make W1 public and Snowdon private, yet the Snowdon tickets (TKT-7, TKT-13, TKT-28, TKT-30, TKT-31) still claim W1, and several tickets cite the old workflow numbers in their bodies (TKT-14, TKT-15, TKT-16, TKT-18, TKT-28, TKT-31). Third, whole clusters were filed in one day each with no Done line behind them: the STEP cluster (twenty tickets on 2026-10-17, seven still open), the IFC mesher parity cluster (thirteen open), and the viewer comparison cluster (TKT-185, TKT-186, TKT-226, TKT-275, TKT-276). Meanwhile three Done lines have no ticket at all: the one-command install (W1), a Claude Code session saved as a notebook (W2), and a script node (W4, blocked on the question TKT-162).

The three most important recommendations. (1) Stop the STEP work until `PROJECT.md` names what it is for: TKT-306 part 2 is unanswered while TKT-312 to TKT-317 proceed, which is the situation brief principle 9 tells a session to stop and ask about; close TKT-299 (done) and TKT-300 (answered), move TKT-315 and TKT-317 to the Plato repository's tracker, and pause TKT-312, TKT-313, TKT-314 and TKT-316. (2) Make TKT-281, the W5 benchmark, the next large piece of work, and fold the scattered measurement tickets into it (TKT-8, TKT-18, TKT-41, TKT-51, the last box of TKT-145); it is the only Done line with a number, and TKT-211 and TKT-212 (table types, the largest W2 build) rest on an effect TKT-281's own body says is unmeasured. (3) Run a one-sitting cleanup: close the 18 tickets listed under "Tickets to close now", answer the owner questions that have a written default (TKT-4, TKT-21, TKT-99, TKT-162, TKT-163, TKT-213), file the three missing Done-line tickets, and rewrite the stale fences before anyone claims those tickets.

## Every open ticket

Verdicts: keep; keep, defer (valid, low value per effort now); rewrite; merge into TKT-n; close (done); close as answered; close as stale; out of scope. "Done line moved" names the clause the acceptance would satisfy, or "none".

| Id | Workflow named | Done line moved | Verdict | Reason |
|---|---|---|---|---|
| TKT-4 | W2 | none | keep | Listed in PROJECT.md "Open questions"; its default (analysis for the saved thing, graph for its structure) is written; decide it with TKT-14. |
| TKT-7 | W1 | none | close as stale | W1 lost Snowdon on 2026-10-04 (CANDIDATE-WORK.md, "Workflow numbers changed"); a Snowdon clean clone helps only the owner, and TKT-165 put the studio on public models. |
| TKT-8 | W2, W5 | W5 (partly) | merge into TKT-281 | Its ten questions are over the private Snowdon export, so they cannot be the committed public benchmark; the Haiku rerun belongs in TKT-281's toolkit arm or a private regression. |
| TKT-12 | W3, kept | W3: "after Run, the report and export exist on disk and the run record names them" | keep, rewrite fence | The only ticket that moves W3's second clause; 22 of 24 fence paths moved to `deps/bim-open-flow`. |
| TKT-13 | W1, W3 | none | close as stale | Snowdon-only charts serve no Done line; `samples/viz-analyses` (14 graphs) and TKT-165 chart public models. |
| TKT-14 | W2 | none | rewrite | Its reason cites "principle 9 (unconfirmed)", but principle 9 is now "work names its workflow"; restate as the start page grouping the generated sample catalog by the contexts of TKT-165 to TKT-169. |
| TKT-15 | W3 | Success line 4 (Snowdon-size budget, unconfirmed) | rewrite | Body says "Serves W4" (old numbering); only C6 and C8, the measurement, remain; retag to the success line and merge TKT-55's budget work into one performance ticket. |
| TKT-16 | W3 | none | rewrite | C1 to C10 and C12 are done (its 2026-10-03 note); replace the Snowdon sample of C14 with a public model, fold in TKT-58, close. |
| TKT-17 | W2 | none (brief principle 7) | keep | Checkable and on principle 7; fence paths moved to `deps/bim-open-flow`. |
| TKT-18 | W5, kept | none | merge into TKT-41 | The code fix landed in 9b6e85a (its own note); the only open item is the model rerun TKT-41 owns. |
| TKT-21 | W2 | none | keep | In PROJECT.md "Open questions"; default option 2 agrees with Scope Out; answer it. |
| TKT-23 | W2, W3 | none | rewrite | The column picker landed (TKT-205, TKT-210) and is broken in the browser (TKT-285); trim to slider, dropdown and swatch; owner-requested polish. |
| TKT-26 | W2 | none (brief principle 7) | keep | C1, C2, C6 done; C4 (MCP tools default to the open analysis) is what makes "add a chart to this" work from Claude Code; 16 of 21 fence paths moved. |
| TKT-28 | W3 | W3 (a picture of the model beside a table) | rewrite | Requires a Snowdon sample and waits on TKT-7; restate over a public model. |
| TKT-29 | W2 | W2 | keep, defer | The surface that joins TKT-17 and TKT-26; build after them. |
| TKT-30 | W1, W3 | none | rewrite | Snowdon is private and W1 is public; C1 to C6 and C8 are built; reclassify as kept and park, or finish C7 to C13 only if the owner still wants the Snowdon demo; 7 fence paths moved to `deps/bim-open-data`. |
| TKT-31 | kept | none | out of scope | Waits on TKT-30, feeds no Done line, and its body cites old W4; park with TKT-30. |
| TKT-33 | W2, W3 | none | keep, defer | Animation the owner asked for; all 7 fence paths moved; touches contracts, so plan it, not a small job. |
| TKT-41 | W5 | W5 / W2 | rewrite | The criterion still says "with a funded Anthropic key", against the owner's 2026-09-27 decision recorded in the same ticket; restate as the Claude CLI with Haiku; its IFC half is superseded by TKT-51 (TKT-51 says so). |
| TKT-42 | process | none | keep, defer | Small debt; every fence path moved. |
| TKT-43 | W2 | none | close as answered | Default "it stays" has stood since 2026-09-26 with no objection. |
| TKT-44 | process | none | keep, defer | Test gap in a jsdom-unreachable path. |
| TKT-45 | W2 | W2 (enables the benchmark runs) | keep | All 13 chunks done (2026-10-03 note); one live Ask-box graph build closes it, and TKT-8, TKT-41, TKT-51, TKT-84 and TKT-165 wait on it. |
| TKT-47 | W2 | none | rewrite | A don't-repeat-yourself debt; every fence path is now in bim-open-flow; retag `process` and fence `deps/bim-open-flow/...`. |
| TKT-49 | kept | none | out of scope | New NRC capability (zones); PROJECT.md Scope keeps NRC "no longer driving priorities". |
| TKT-50 | kept | none | close (done) | All three acceptance boxes are ticked; the notes list leftovers that are not criteria. |
| TKT-51 | W5 | W5 | merge into TKT-281 | A Duplex question set with graph-computed answers is the right first slice of the committed benchmark; drop the zone questions that wait on TKT-49. |
| TKT-52 | kept | none | keep | A shipped sample with ten reviewed defects, two of them honest-absence failures (the inner join drops 50 rows; "physical" counts the 21 spaces); principle 3. |
| TKT-53 | kept | W3 (after Run) | keep, defer | Byte-exact write-back through Run is kept scope and the same mechanism as W3's Run clause; after TKT-12. |
| TKT-54 | kept | none | out of scope | An NRC handover bundle; valid only if an NRC delivery is still owed, which PROJECT.md does not say; owner to confirm. |
| TKT-55 | kept | Success line 4 (in part) | merge into TKT-15 | A second performance-budget ticket, NRC-specific; one budget ticket should serve the success line. |
| TKT-56 | kept | none | out of scope | Generalizing NRC graphs; TKT-236 covers model independence for the current samples. |
| TKT-57 | W2 | W5 (support: results as text for grading) | keep | Library and endpoint done; goldens and `describeAnalysis` remain; fence moved to bim-open-flow. |
| TKT-58 | W3 | none | merge into TKT-16 | It says so itself; a principle 3 bug inside TKT-16's fence. |
| TKT-59 | W2 | none | rewrite | Three unrelated leftovers; cites `submodules/ara3d-dataflow`, which is gone; split, and check whether projection aliases (TKT-134, TKT-238) make `rel.rename` unnecessary. |
| TKT-61 | W2 | none | rewrite | SDK bug with a working workaround; no W2 link; retag `process`. |
| TKT-62 | process | none | keep, defer | Cleanup; half the fence paths moved. |
| TKT-63 | W2 | none | keep, defer | A memory risk for the Snowdon-size success line, not for W2. |
| TKT-64 | W2 | none | keep, rewrite fence | A correctness bug; the TODO is still at `deps/bim-open-data/src/data/Ara3D.BimOpenSchema.Harmonizer/UnitConversion.cs:19` (checked); every fence path is stale. |
| TKT-65 | W3 | none | keep, defer | Parity against web-ifc at 0.92 to 0.96; moves no Done line. |
| TKT-66 | W3 | W3 (export after Run) | merge into TKT-181 | The same GLB writer node. |
| TKT-67 | process | none (protects W2, W3) | keep | One end-to-end gate over SQL, write-back, MCP and Ask is cheap protection for what the benchmark measures. |
| TKT-68 | W2 | none | keep, defer | The prototype's favourite node; no Done line names it. |
| TKT-69 | process | none | rewrite | `PLAN.md` (2026-08-30) names homes the repository split superseded; keep only the items still true, likely the CI BOS conversion job. |
| TKT-71 | kept | none | close as answered | Its default (stay here) holds, and bim-open-schema is the spec only (AGENTS.md table). |
| TKT-72 | W2 | none | keep | Principle 3 needs one null rule; TKT-198 and TKT-200 are instances of the missing rule. |
| TKT-73 | W3 | none | close as answered | Its own 2026-10-11 note: TKT-202 answered it for file-backed sources (hash the resolved file); reopen only if a fileless registry source appears. |
| TKT-74 | W2 | none | close as answered | TKT-209 (schema pass served by the host and MCP, shown on wire peek) and TKT-210 (pickers from schemas before data) are done. |
| TKT-75 | process | none | close as answered | Default "freeze"; the viewer is now `ara3d/bim-open-viewer`, where any further decision belongs. |
| TKT-76 | W1 | none | close as answered | `deps.json` pins Gratify by commit (AGENTS.md), and the public pages build from that pin. |
| TKT-77 | W2 | none | close as answered | TKT-135 takes the fixed-ports route (inputs a to d); no spec change. |
| TKT-78 | W2 | none | keep | `src/flow/BimOpenFlow.Nodes.Bos/BosQueryNode.cs` still ships (checked) and no sample uses it; delete it. |
| TKT-79 | process | none | keep, defer | Generic DuckDB code now lives partly in bim-open-flow's `BimOpenFlow.Relations.DuckDb`; check what generic code is left in `Ara3D.BimOpenSchema.DuckDb`, then close. |
| TKT-80 | W2 | W3 (notebook opens with no host) | keep | Prototype done; one live multi-turn run and the web smoke remain. |
| TKT-84 | W2 | W2 | keep | The owner's expectation of an Ask box beside any graph; after TKT-45; overlaps TKT-29. |
| TKT-87 | W3 | W3 (a second person re-evaluates) | keep | Restoring a notebook writes to the store, which breaks brief principle 2's promise that exploring does no harm. |
| TKT-88 | W3 | none | keep, defer | Selection polish. |
| TKT-90 | process | none | keep, defer | Notebook internals. |
| TKT-91 | W3 | none | rewrite | No acceptance criteria; a list of future embed kinds; restate when TKT-12 lands. |
| TKT-99 | W2 | none (correctness of answers) | keep | Two join nodes give different row counts for one question; accept its recommendations so TKT-131 can start. |
| TKT-100 | W2 | W2 | keep | The Ask check forces Claude to invent an `answer` node; small. |
| TKT-101 | W2 | none | keep, defer | Overlapping nodes after an Ask edit. |
| TKT-104 | W2 | none | keep, defer | An open design question (fork or rewrite history) with no acceptance. |
| TKT-105 | W3 | none | keep, defer | No acceptance criteria. |
| TKT-106 | W3 | none | keep, defer | Gratify core; needed only for two editable canvases on one page. |
| TKT-107 | process | none | keep, defer | Refactor; fence paths moved. |
| TKT-115 | W3 | none | keep, defer | Document text; 3 of 5 fence paths moved. |
| TKT-117 | W1 | none | keep | Don't repeat yourself: `scripts/seed-store.mjs` still exists (checked) beside the host's seeding. |
| TKT-118 | W1 | none | keep, defer | A notice for a kept edited sample. |
| TKT-123 | W2 | none | keep, defer | Canvas polish; every fence path moved. |
| TKT-126 | W2 | W2 | keep, defer | After TKT-57 and TKT-26. |
| TKT-129 | W2 | none | keep | Removes six copies of one SQL join; TKT-212's `bim.schedule` wraps it (TKT-129's own note). |
| TKT-130 | W2 | W2, W5 (fewer wrong totals) | keep | Storey joins caused the double counts of TKT-18 and IFC-Bench 213 and 236; absorb TKT-235. |
| TKT-131 | W2 | none | keep, defer | After TKT-99; honest absence in one node. |
| TKT-132 | kept | none | keep, defer | Write-back helper. |
| TKT-133 | W2 | none | keep | Absorb TKT-231. |
| TKT-135 | W2 | none | keep, defer | Answers TKT-77 as well. |
| TKT-136 | W2 | none | keep, defer | Parity between packs. |
| TKT-142 | W1 | W1 ("the public pages open every sample notebook") | rewrite | All five Pages sites answer HTTP 200 (checked); only `gh auth login` remains (`gh auth status`: not logged in). |
| TKT-144 | W1 | W1 | close as answered | Owner decisions of 2026-10-03 and 2026-10-12 settle every model the toolkit ships; the Autodesk examples belong to bim-open-schema. |
| TKT-145 | W5 | W5 | keep | Three of four boxes ticked; add the IFC-Bench row and close. |
| TKT-146 | W1 | W2 (an agent call that never returns) | keep | Small hang fix. |
| TKT-147 | kept | none | keep | One-line test fix. |
| TKT-148 | W2, W5 | W2 | keep | A guide line measured on two IFC-Bench questions. |
| TKT-149 | process | none | keep, defer | Duplicate config. |
| TKT-150 | process | none | keep, defer | Duplicate notice text. |
| TKT-151 | process | none | keep, defer | Duplicate path helper. |
| TKT-154 | W3 | W3 ("opens ... in a second person's local notebook") | keep | A graph hash that depends on the checkout folder breaks both the second machine and run evidence (brief principle 4). |
| TKT-155 | W3 | W3 | keep | Re-evaluate reports a false change; small. |
| TKT-156 | W3 | W3 (public page) | rewrite | Public notebook graphs draw no wires; add an acceptance criterion. |
| TKT-157 | W2 | W2 | keep | A door schedule shown as pipe characters; small. |
| TKT-158 | W2 | W2, W3 (a recorded session) | keep | The closest ticket to the "session saved as a notebook" Done line. |
| TKT-160 | W3 | W3 (a picture of the model on the public page) | keep | `recordedFeed` is committed in `deps/bim-open-notebook/.../view3dEmbed.ts` (checked); verify the three public 3D views and close; the fence entry is malformed (a brace split across items). |
| TKT-162 | W4 | W4 | keep | Blocks W4 entirely; decide now and file the build ticket. |
| TKT-163 | W3 | W3 | keep | Default option 1 agrees with Scope Out; answer it. |
| TKT-165 | W2, W1 | W2 | keep | Two of three boxes done; the third waits on TKT-45. |
| TKT-166 | W3 | W3 | rewrite | Criterion 1 names "C:/Program Files/Git/showcase.html", a Git Bash path mangling of `/showcase.html`. |
| TKT-167 | W3 | none (kept rule check) | keep, defer | A front door for kept scope. |
| TKT-168 | W3 | W3 (after Run) | keep, defer | After TKT-12. |
| TKT-169 | kept | none | keep, defer | Presentation of existing material. |
| TKT-181 | W3 | W3 (export after Run) | keep | BCF done; GLB, USD and `.frag` wait on TKT-12; absorb TKT-66. |
| TKT-185 | W1, W3 | none | out of scope | Speckle appears nowhere in PROJECT.md. |
| TKT-186 | W3 | none | out of scope | A second renderer in the studio; W3 already has a 3D pane. |
| TKT-188 | W2 | W2 (answers agree with the picture) | keep | MCP volume and bounds can disagree with the GLB the user sees; IFC-Bench's geometric category is the weakest, 3 of 11 (TKT-145). |
| TKT-189 | W2 | W3 (the picture is right) | keep | The public Duplex has no roof node in BOS; it changes the samples, so do it with TKT-247. |
| TKT-190 | W2 | none | keep, defer | Triangle density parity. |
| TKT-191 | kept | none | keep, defer | SDK cleanup. |
| TKT-192 | W3 | none | keep, defer | Duplicate validation in bim-open-data. |
| TKT-193 | W2 | none | keep | Fabricated GlobalIds break principle 3; a correctness fix is not "extending" the exporter. |
| TKT-194 | W2 | none | keep, defer | Measure first. |
| TKT-195 | W2 | none | close as stale | No acceptance criteria and a measured gain of 36 ms in 373 (its own numbers); polish principle 9 warns against. |
| TKT-196 | W3 | none | out of scope | USD is in no workflow, and the large model it is for (Snowdon) is private. |
| TKT-197 | kept | none | keep | A solution that fails to build in linked mode costs every agent time (engineering principle 3). |
| TKT-198 | W2 | none | keep | Principle 3; small. |
| TKT-199 | W2 | none | keep, defer | Session leftovers. |
| TKT-200 | W2 | none | keep | Principle 3; small. |
| TKT-201 | W2 | none | keep | Principle 3; small. |
| TKT-211 | W2 | W2 (hypothesis) | keep, defer | Large; TKT-281's body says the benefit of declared columns to Claude is unmeasured; measure first. |
| TKT-212 | W2, W5 | W2 | keep, defer | After TKT-213 and a first TKT-281 run. |
| TKT-213 | W2 | none | keep | Recommendations are written; decide. |
| TKT-214 | W1 | W1 (public pages) | keep | Small. |
| TKT-215 | W2 | none | keep | The guide item (what `duck.source` emits) is also the Ask box's system prompt. |
| TKT-217 | W2 | none | keep, defer | Small UI defect. |
| TKT-218 | W3 | W3 | keep | A published notebook says which model a result came from (brief principle 8). |
| TKT-219 | W2 | none | merge into TKT-228 | TKT-228 is the cause found for the same symptom; carry the `bim.rooms` criterion over. |
| TKT-220 | none | none | rewrite | No workflow named; name W3 and accept the default (option 1). |
| TKT-221 | none | none | out of scope | No toolkit Done line needs a basemap. |
| TKT-222 | none | none | rewrite | No workflow named; name W3 and decide with TKT-88. |
| TKT-223 | W2 | none | keep, defer | A mesher refactor tagged W2. |
| TKT-224 | process | none | keep, defer | Portability. |
| TKT-226 | W5 | none | rewrite | A six-viewer page does not move W5, which compares the toolkit with a bare Claude session; retag (owner request); only Pages remains. |
| TKT-227 | W3 | none | keep | Build on TKT-130's storey rule so there is one. |
| TKT-228 | W3 | none | keep | Absorb TKT-219. |
| TKT-229 | W3 | none | keep | Coverage overstated by placeholder values; principle 3. |
| TKT-230 | W3 | none | keep, defer | Area column and room rules. |
| TKT-231 | W3 | none | merge into TKT-133 | Same aggregate list. |
| TKT-232 | W3 | none | keep | Removes a join every colouring graph needs. |
| TKT-233 | W3 | none | close as answered | Default (a) is recommended and trivial; do it. |
| TKT-234 | W3 | W3 (a chart) | keep | Blocked on a bim-open-plot pack that has no ticket; file it. |
| TKT-235 | W3 | none | merge into TKT-130 | The same storey rule. |
| TKT-236 | W3, W5 | W5 (questions over several public models) | keep | Model-independent graphs are what a benchmark over several models needs. |
| TKT-238 | W2 | none | keep, defer | Over the private Snowdon export. |
| TKT-239 | W2 | none | keep | Engine bug; needs a format-spec decision. |
| TKT-240 | W2 | none | rewrite | Fifteen unrelated items; CODING.md asks one chunk per finding; split. |
| TKT-241 | W2 | none | close as answered | TKT-182 chose PascalCase; take option 1. |
| TKT-242 | W3 | none | keep, defer | Mesher parity. |
| TKT-243 | W3 | none | keep, defer | Mesher; the STEP library's chunk F designs the same algorithm (see "The STEP cluster"). |
| TKT-244 | W3, W5 | none | keep, defer | W5 is cited wrongly. |
| TKT-245 | W3 | none | keep, defer | Ratchets on parity. |
| TKT-246 | kept | none | keep, defer | IDS type lookup. |
| TKT-247 | kept | W1, W2 (public samples answer right) | keep | Every committed public `.bos` predates type-object property sets; bundle with TKT-189. |
| TKT-248 | kept | none | keep, defer | IDS material facet. |
| TKT-249 | W2 | W2 | keep | MCP parameter counts include type objects. |
| TKT-250 | W3 | none | keep, defer | A 16-chunk refactor (`docs/plans/ifc-mesher-kernel.md`). |
| TKT-251 | W3 | none | keep | Small correctness. |
| TKT-252 | W3 | W2 (volume answers) | keep | A mirrored instance's volume enters `ifc_volume` with the wrong sign. |
| TKT-274 | W3 | none | keep, defer | SDK geometry. |
| TKT-275 | W5 | none | rewrite | Owner action for the bench; not W5. |
| TKT-276 | W5, W3 | none | out of scope | Owner request (2026-10-11) with no Done line; owner's call. |
| TKT-280 | W3 | W3 | keep | Graphs load each building twice; reading `.bos` lets public notebooks carry one file. |
| TKT-281 | W5 | W5 (the whole Done line) | keep | The only Done line with a number; absorbs TKT-8, TKT-41, TKT-51. |
| TKT-282 | W2 | W2 | keep | Claude in the Ask box sees Error and Unknown schemas the MCP server reports correctly; one file. |
| TKT-283 | W2 | none | rewrite | Overlaps TKT-298; trim to what TKT-298 leaves. |
| TKT-285 | W2 | none | keep | A shipped control that never opens. |
| TKT-287 | W2 | none | keep, defer | Layout polish. |
| TKT-288 | W2 | none | out of scope | A node-graph instrument feature no workflow needs (Scope, Out). |
| TKT-293 | W1 | W1 (fresh machine) | keep | Owner action; restore without a sibling clone. |
| TKT-295 | W3 | none | keep, defer | Duplicate theme. |
| TKT-298 | W2 | none | keep | Lowers a ratchet that was raised to get CI green. |
| TKT-299 | W3, W4 | none (its body says so) | close (done) | All four boxes ticked; implementation has its own tickets. |
| TKT-300 | W3, W4 | none | close as answered | `PLAN.md` "Decided by the owner": F-1 is resolved by generated C# types and TKT-300 is unnecessary. |
| TKT-306 | W3, W4 | none | keep | Part 1 answered; part 2, which workflow STEP serves, is what every STEP ticket rests on. |
| TKT-312 | W3, W4 | none | out of scope | Pause until TKT-306 part 2 is answered. |
| TKT-313 | W3, W4 | none | out of scope | Pause until TKT-306 part 2 is answered. |
| TKT-314 | W3, W4 | none | out of scope | Pause until TKT-306 part 2 is answered. |
| TKT-315 | W3, W4 | none | close as stale | Plato repository work, a duplicate of Plato's plato-271; its acceptance omits the writer fixes TKT-312 says it carries. |
| TKT-316 | W3, W4 | none | out of scope | Pause until TKT-306 part 2 is answered. |
| TKT-317 | W3, W4 | none | close as stale | A Plato interpreter is Plato repository work; file it there. |

## Tickets to close now

Each with the line it rests on.

- **TKT-50**: all three acceptance boxes are ticked in the ticket file.
- **TKT-299**: all four boxes are ticked; its log says "Left open under this fence until implementation gets its own ticket", and TKT-314 and TKT-316 are that ticket.
- **TKT-300**: `sandbox/step-brep-mesh/PLAN.md`, "Decided by the owner during the pass", first item: "F-1 is resolved by generated types and TKT-300 is unnecessary"; `docs/plans/step-reader.md`, "Pivot": "TKT-300 is not needed".
- **TKT-43, TKT-71, TKT-75, TKT-233, TKT-241**: each states a default or a recommendation that nothing since contradicts; close with it, and do the one-line change for TKT-233 and the rename for TKT-241.
- **TKT-73**: its 2026-10-11 note answers it for every file-backed source.
- **TKT-74**: TKT-209 and TKT-210 are done.
- **TKT-76**: AGENTS.md, "Where the dependencies come from": `deps.json` pins by commit.
- **TKT-77**: TKT-135 chose four fixed optional ports.
- **TKT-144**: the notes of 2026-10-03 and 2026-10-12 record the owner's decisions for every model the toolkit ships.
- **TKT-7, TKT-13**: W1 dropped Snowdon (`docs/CANDIDATE-WORK.md`, "Workflow numbers changed on 2026-10-04"); TKT-165 and `samples/viz-analyses` cover public charts.
- **TKT-195**: no acceptance criteria; 36 ms of 373.
- **TKT-315, TKT-317**: file them in the Plato repository's tracker (it already has ids such as plato-271 and plato-370, cited in TKT-312 and `PLAN.md` open question 1) and close here.

Close after one small step: TKT-45 (one live Ask-box run), TKT-145 (the score row), TKT-160 (verify three public 3D views), TKT-80 (one live multi-turn run and the web smoke), TKT-16 (a public sample instead of Snowdon).

## Tickets to rewrite

- **TKT-12, TKT-17, TKT-26, TKT-33, TKT-42, TKT-47, TKT-57, TKT-59, TKT-62, TKT-64, TKT-87, TKT-88, TKT-106, TKT-107, TKT-115, TKT-117, TKT-123, TKT-126, TKT-18, TKT-23, TKT-28, TKT-29, TKT-30, TKT-45, TKT-50, TKT-66, TKT-198**: fence paths that the repository split moved. `bimopenflow/web/packages/{graph,state,panes,contracts}`, `contracts/`, `src/flow/BimOpenFlow.Host*`, `src/flow/BimOpenFlow.GraphText`, `src/mcp/BimOpenMcp.Flow` now live under `deps/bim-open-flow/`; `src/data/` under `deps/bim-open-data/`; `submodules/` is gone. A builder who claims one of these tickets today cannot honour its fence. Per AGENTS.md the fence becomes `deps/<repo>/...` and the commit goes to that repository.
- **TKT-41**: replace "Rerun bimopenmcp-ifc-ask ... with a funded Anthropic key" with "through the Claude Code command line, model claude-haiku-4-5-20251001 at medium effort (TKT-45)", keep the five Ask requests, and drop the eight IFC questions now that TKT-51 supersedes them, or let TKT-281 absorb the whole ticket.
- **TKT-14**: acceptance should say: the start page lists the sample graphs grouped by the five contexts of `docs/proposals/demo-contexts.md`, generated from `workflows.json` and the sample folders; a template opened over a model missing an input shows needs-setup. Delete the "principle 9 unconfirmed" sentence.
- **TKT-15**: name the success line ("a model of Snowdon's size ... first 3D frame ... fit a published budget"), not W3; merge TKT-55's budget-and-gate criteria; the result is one published budget table and one gate.
- **TKT-16**: C14 becomes "a sample over a public model (Schependomlaan or the DigitalHub union) demonstrates the shared legend"; add TKT-58's two criteria.
- **TKT-23**: drop the column picker; keep slider, dropdown, swatch and the showcase graph.
- **TKT-28**: "a committed sample over a public model colours the model by a value a table node computed".
- **TKT-30**: retag `kept`; state that it is parked unless the owner wants the Snowdon demo, and why (Snowdon is private, PROJECT.md W1).
- **TKT-47, TKT-61**: retag `process`; neither moves W2.
- **TKT-59**: split into three tickets or close the items that no longer apply; fix the `submodules/` path.
- **TKT-69**: keep only the CI BOS conversion job if it is still missing; the other phases belong to other repositories.
- **TKT-91, TKT-156**: add acceptance criteria. TKT-156: "a public notebook's graph embed draws every connection with no host".
- **TKT-142**: Pages is done; the ticket is now "run `gh auth login`; `gh auth status` succeeds".
- **TKT-166**: criterion 1 reads "`/showcase.html` loads a public model ...".
- **TKT-220, TKT-222**: fill the workflow field (W3) so `ticket.py` and brief principle 9 can see them.
- **TKT-226, TKT-275**: retag; a viewer comparison is not W5. If the owner wants it measured, W5's brief text needs a second arm or the bench needs its own component brief.
- **TKT-240**: one ticket per finding, as CODING.md "Fix and Sweep" asks.
- **TKT-283**: remove the four node kinds TKT-298 covers.
- **TKT-306**: part 2 needs an answer in PROJECT.md, not a default in a ticket (see below).

## Duplicates and contradictions

Duplicates:

| Tickets | Overlap | Resolution |
|---|---|---|
| TKT-8, TKT-18, TKT-41, TKT-51, TKT-145, TKT-281 | Six tickets measure Claude on question sets; only TKT-281 is the committed public benchmark of W5 | TKT-281 holds the public set; TKT-51's Duplex questions are its first slice; TKT-8 stays a private regression or closes |
| TKT-66, TKT-181 | A GLB writer node | TKT-181 |
| TKT-130, TKT-235, TKT-227; design note 2 of TKT-52 | One storey rule per element | TKT-130 defines it; TKT-227 uses it in `bim.elements`; TKT-235 merges |
| TKT-133, TKT-231 | Aggregate functions | TKT-133 |
| TKT-129, TKT-212 | Property columns on elements | TKT-129 first, wrapped by `bim.schedule` |
| TKT-219, TKT-228 | `bim.bounds` returns 0 rows | TKT-228 |
| TKT-283, TKT-298 | Declared schemas for display nodes | TKT-298 first, TKT-283 the remainder |
| TKT-77, TKT-135 | Variadic inputs | TKT-135 |
| TKT-58, TKT-16 | Palette grey | TKT-16 |
| TKT-15, TKT-55 | Performance budgets, two models, two gates | One ticket on the success line |
| TKT-17, TKT-29, TKT-84 | Agent edits in the editor and the Ask panel | Keep, but build 17 then 84 then 29, and let 29's fence follow 17's |
| TKT-315, plato-271 | The 64-bit Number profile | plato-271 in the Plato repository |
| TKT-243, TKT-190, TKT-250; STEP library layers 1, 4, 5 | B-spline evaluation, curve sampling and face meshing written twice, once in C# for IFC and once in Plato for STEP | See "The STEP cluster" |

Contradictions:

- TKT-41's criterion requires a funded Anthropic key; its own "Owner's decision, 2026-09-27" forbids the API account.
- TKT-14 says principle 9 is "unconfirmed" and means "start from data"; PROJECT.md principle 9 is now "Work names its workflow and its measure".
- TKT-7, TKT-13 and TKT-30 claim W1, which the 2026-10-04 brief made public-model only.
- TKT-306's default for part 2 ("product models ... shown with the building in the 3D view") is several models in one view, which PROJECT.md Scope lists as Out ("several models in one graph or one Run (TKT-21 may reopen this)").
- TKT-312 says TKT-315's builder "applies TKT-311's six C# writer fixes and three stdlib fixes"; TKT-315's acceptance covers only the Number profile.
- TKT-226, TKT-244, TKT-275, TKT-276 and `docs/plans/ifc-mesher-roadmap.md` (line 3) cite W5 for "another tool's number"; W5 compares the toolkit with a bare Claude session.
- PROJECT.md W1 "Today" says the notebook's GitHub Pages is not switched on; all five Pages sites answer HTTP 200 on 2026-10-17. The brief's "Today" text is stale.
- `docs/CANDIDATE-WORK.md` "The first stretch, in order" still ranks tickets by the old workflow numbers, and 14 of its 22 rows are done (TKT-9, 10, 11, 19, 20, 22, 24, 25, 27 among them). It no longer orders anything; the archivist skill should revise or supersede it.

## Questions already answered

| Question | Answered by |
|---|---|
| TKT-73 (what a Run hashes for a registry source) | TKT-202, recorded in TKT-73's own note of 2026-10-11 |
| TKT-74 (showing a schema before the node is clicked) | TKT-209 and TKT-210, both done 2026-10-12 |
| TKT-76 (how Gratify is consumed) | `deps.json` and `node deps.mjs` (AGENTS.md) |
| TKT-77 (variadic ports) | TKT-135's fixed ports a to d |
| TKT-144 (which models may be redistributed) | the owner's decisions in its notes, 2026-10-03 and 2026-10-12 |
| TKT-300 (typed STEP layer in Plato) | `PLAN.md`, "Decided by the owner during the pass" |
| TKT-306 part 1 (C# reader or Plato library) | the same section: parse and decode in C#, geometry in Plato |
| TKT-43, TKT-71, TKT-75, TKT-233, TKT-241 | their own written defaults, unchallenged |

Still genuinely open and worth an hour of the owner's time, in this order: TKT-162 (blocks W4), TKT-306 part 2 (blocks or ends the STEP cluster), TKT-213 (blocks the largest W2 build), TKT-99 (two joins disagree), TKT-163, TKT-21, TKT-4, TKT-72.

## The STEP cluster

**What it is.** TKT-299 to TKT-318 were all filed on 2026-10-17. Thirteen closed the same day (the parser fixes TKT-302, TKT-307, TKT-310; the EXPRESS grammar and generated types TKT-303, TKT-304; model assembly TKT-305; kernel fixes TKT-308, TKT-309; the spikes TKT-301, TKT-311; TKT-318). Open: the Plato design TKT-299 (done in substance), TKT-300, the question TKT-306, the C# decoder TKT-312, the call into compiled Plato TKT-313, chunk A of the Plato library TKT-314, the Number profile TKT-315, test tooling TKT-316, and a Plato interpreter TKT-317. The design pass alone ran nine parallel design agents, a 125-commit fix wave, and produced 6,710 type-checked functions (`sandbox/step-brep-mesh/README.md`, "Status").

**It names no Done line it moves.** Every STEP ticket says W3 and W4. W3's Done line is a notebook holding a table, a chart and a picture of the building that opens publicly and on a second machine, plus Run writing reports and exports; the toolkit already produces pictures from IFC and BOS, and nothing in that sentence needs STEP. W4's Done line is a node written as a script appearing in the catalog "without editing the host"; a compiled C# STEP pack is the opposite of that. TKT-299 says so itself: "this pass moves no Done line". TKT-306 part 2 asks which workflow STEP serves and has no answer; `docs/plans/step-reader.md` calls its own answer "the working guess". Brief principle 9 is explicit: "a session that cannot name one stops and asks". Seven tickets proceeded instead.

**The guessed purpose does not fit the brief.** The default is product models (equipment, fixtures) shown with the building. That is several models in one view, which PROJECT.md Scope puts Out. The test corpus is the u-blox library, 88 files of GNSS and radio modules (`TASKS.md`, chunk H), not building products. The first user is a BIM professional working through Claude (TKT-1); no workflow, user line, or success line mentions mechanical CAD. Building equipment normally reaches that user inside the IFC file, which the toolkit already reads.

**The two paths: not a duplicate of each other, but a duplicate of the IFC kernel.** After the owner's pivot (TKT-306 part 1), C# parses, types, decodes to `RawDecodedModel` and assembles placements and colours, and Plato does the geometry. Those two halves do not overlap; the original C# geometry builder (TKT-305 part A) was stopped before it committed anything. The duplication is elsewhere. `docs/plans/step-reader.md` says "IFC's geometry entities are ISO 10303-42 entities with an `Ifc` prefix" and planned "STEP readers over the generated types that feed the same kernel", `Ara3D.MeshKernel`. The pivot keeps IFC on that C# kernel ("TKT-308 and TKT-309 stay: they serve the IFC mesher, which remains in C#") and gives STEP a second kernel in Plato for the same curves and surfaces. Open C# tickets then rebuild in C# what the Plato library designs: TKT-243 (B-splines from knots and weights) against the Plato library's chunk F, TKT-190 (curve sampling density) against layer 4's discretization, TKT-250 (extracting the C# kernel) against the whole library. Engineering principle 4 ("each piece of information and code has one well-defined, obvious location") is broken at the scale of a geometry kernel. One of two things should be decided: the Plato library becomes the kernel for IFC as well, with a plan for moving the IFC mesher onto it; or STEP meshes through `Ara3D.MeshKernel` like IFC and the Plato library continues as a Plato project, not a toolkit dependency.

**Correctness risk on the critical path.** TKT-313 runs the geometry as Plato compiled to C#. TKT-311's spike found the writer silently miscompiles a conditional used as a condition, about 97 laws and checks, so `Law_TriangleMinAngleMeetsThreshold` never tests the angle; sum equality throws on an inactive case; `spec` blocks stop the parser (`docs/plans/step-reader.md`, TKT-311 table). FINDINGS F-50 adds nested conditionals (commit f48ea348). Engineering principle 1 comes first, and a meshing path whose test laws can pass vacuously cannot show it is correct until the compiler is fixed. That compiler work is a Plato project's critical path, not this toolkit's.

**The language work belongs in the Plato repository.** AGENTS.md says tickets for repositories under `deps/` live here so ids never collide. Plato is not under `deps/`; TKT-315 and TKT-317 fence `../plato/**`, and Plato has its own tracker (plato-271 is the Number profile TKT-315 duplicates; plato-370 is cited in `PLAN.md` open question 1). The sandbox itself, `sandbox/step-brep-mesh`, is a Plato stdlib-tier design; `PLAN.md` open question 3 already asks whether it belongs in the stdlib, a new tier, or its own repository. Its home is not this toolkit's ticket list.

**What was worth it.** The parser and kernel fixes help IFC today: TKT-307 found the published parser read `-1.` as 1, TKT-302 and TKT-310 made the parser handle complex instances and report diagnostics instead of throwing, and TKT-308 and TKT-309 fixed twisted bands and flat curved faces in the IFC kernel. Those are closed and should stay.

**Recommendation.** Close TKT-299 and TKT-300. Move TKT-315 and TKT-317 to Plato's tracker. Pause TKT-312, TKT-313, TKT-314 and TKT-316. Put TKT-306 part 2 to the owner as a brief change: either PROJECT.md gains a STEP line in a workflow (with an actor, a Done line, and a resolution of the Scope Out conflict) and a decision on one geometry kernel, or the STEP work moves with the Plato library to its own repository and leaves this list.

## Gaps: work the brief's Done lines need that no ticket covers

1. **W1, one-command install.** "On a fresh machine, the documented install takes one command" that "registers the MCP servers and skills in Claude Code". No open ticket builds it. TKT-290 (a fresh clone builds with the .NET 8 SDK) and TKT-293 (NuGet publish) are prerequisites; TKT-9 made a start page. Needed: one command (a Claude Code plugin or a script) that fetches or builds the two MCP servers, writes the MCP configuration and skills, and a fresh-machine check in which Claude answers one question about a public model.
2. **W2, a Claude Code session saved as a notebook.** "A session in Claude Code saves as a notebook that opens with no host." TKT-80 and TKT-158 record sessions from the studio's Ask box; nothing turns a Claude Code conversation over the MCP servers into a `.notebook.json`. Success line 3 ("a notebook recorded live in Claude Code") depends on it too.
3. **W4, the script node itself.** TKT-162 asks the language question; no ticket builds a script node, its catalog entry, its test, or the tool description Claude sees. File it the day TKT-162 is answered.
4. **W3, "a second person's local notebook environment".** The brief does not say what that environment is (the toolkit's notebook page run locally, or Jupyter). TKT-154, TKT-87 and TKT-163 each cover a piece; no ticket states the check "a second clone opens notebook X and Re-evaluate reports no change".
5. **W5, the bare arm.** TKT-281 states it; nothing yet defines what "only the raw files and a shell" provides (DuckDB CLI? Python? IfcOpenShell?). Without that, the comparison is not reproducible. Add it as a criterion of TKT-281.
6. **Success line 4, a published budget.** The Snowdon-size budget is "(unconfirmed)" in PROJECT.md and no ticket publishes one; TKT-15 measures a first frame, TKT-55 NRC timings. One ticket, after the owner confirms the line.
7. **Brief coverage.** STEP, Speckle, USD, the six-viewer bench, and the purpose of a C# IFC mesher beside web-ifc (PROJECT.md "Augments ... web-ifc and three.js") appear in tickets and plans but not in the brief. Each needs a line in PROJECT.md or its tickets should stop.
8. **A bim-open-plot pack ticket.** TKT-234 is blocked on "bim-open-plot's C# plot pack", which has no ticket.

## Recommended order

The next ten by value per unit of work. Closures and decisions from the sections above come first and cost an hour; they are not counted here.

1. **TKT-45**: one live Ask-box graph build, then close. Smallest step, and five tickets wait on it.
2. **TKT-282**: the Ask path uses the host's schema catalog. One file; Claude stops seeing false Error and Unknown schemas.
3. **TKT-281** (absorbing TKT-8, TKT-41, TKT-51 and TKT-145's row): the W5 benchmark with both arms. The only Done line with a number, and the measure every later W2 decision (TKT-211, TKT-212) needs.
4. **New ticket, gap 1**: one-command install that registers the MCP servers and skills, with a fresh-machine check. Moves W1's Done line; TKT-293 is its owner action.
5. **TKT-162** (an owner decision), then the script-node ticket of gap 3. Unblocks W4, which has nothing else.
6. **TKT-12**: Run from the editor. Large, but it is W3's second clause and unblocks TKT-53, TKT-168 and TKT-181; rewrite the fence first.
7. **TKT-158 with gap 2**: a recorded live session, from the studio and from Claude Code, among the public notebooks. Moves W2 and success line 3.
8. **TKT-154 and TKT-155**: graph hashes free of the checkout path, and a tolerance on re-evaluated numbers. Small; they make "opens on a second person's machine" true.
9. **TKT-130** (absorbing TKT-235, used by TKT-227): one storey rule. Small to medium, and it removes the double-count cause behind TKT-18 and two IFC-Bench failures.
10. **TKT-26**, chunks C3 to C5, C7 and C8: Claude Code and the Ask box default to the open graph. Brief principle 7, already a third built.

Just behind these: TKT-189 with TKT-247 (the public Duplex's missing roof and stale samples), TKT-188 and TKT-252 (geometry answers that disagree with the picture or carry a wrong sign), TKT-52's ten defects, and TKT-160's verification.
