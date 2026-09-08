# Tooling ledger

Tracks whether each tool, check, metric and process rule used in the V2 work earns its cost. The user's concern (2026-09-07): checkers can hinder more than help. Rule: every entry gets a verdict at the end of each wave; anything judged a hindrance is turned off or scoped down, and the change is recorded here with the reason. Numbers are measured, not estimated; "caught" means a real defect that would otherwise have shipped, counted from track checkpoints (each track keeps a "Tooling" section) and supervisor runs.

Verdicts: **keep**, **adjust**, **off**, **watch** (not enough evidence yet).

| Tool or rule | Cost per run | Runs | Caught | Friction incidents | Verdict | Notes |
|---|---|---|---|---|---|---|
| `tsc --noEmit` over V2 packages (root tsconfig, strict plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | 4 to 5 s | 3 | 0 (skeletons only) | 0 | watch | Expected to be the main defect catcher once tracks write code. |
| ESLint, untyped `recommended` over V2 packages (`npm run lint`, in the gate) | 2 to 4.5 s for all packages | 3 | 0 | 0 | keep | Replaced the type-aware set on 2026-09-07 (see review log). Cost is process startup; file count does not matter. |
| ESLint, type-aware set over I/O packages only (`npm run lint:typed`, demos, mcp, viewer; wave integration only) | 15 s | 2 | 0 | 0 | watch | Kept only for `no-floating-promises` and the unsafe-any family where I/O code lives. Drop if it catches nothing by end of wave 2. |
| Escape-hatch ratchet (`any`, `as`, `!`, directives, disables) | 0.5 s | 3 | 0 | 2 | watch | Friction: platonic-ts's step shells out to a platonic-ts-only command (worked around in the wrapper); the counts include alpha packages another session edits, so the baseline moved without any V2 change and had to be rewritten. |
| `undocumentedExports` counter (one `//` line above every export) | included above | 3 | 0 | 0 | watch | Risk: pushes agents to write comments that restate the signature. Judge by sampling comments at wave end. |
| V2 smoke tests (`npm run test:v2`) | 3 s | 4 | 0 | 1 | keep | Friction: a root `vitest.config.ts` hid the alpha tests; renamed. |
| Alpha package suites (core, controls, loaders, visualization) | 10 s total | 4 | 0 | 0 | keep | Guards the read-only packages while another session edits them. |
| `demo:check` and `npm run build` (alpha) | 60 s | 2 | 0 | 0 | keep | Confirms the retrofit changed nothing for the alpha. |
| `check-baselines.mjs` (planning documents) | under 1 s | 2 | 0 | 0 | keep | Cheap; protects the brief and history bytes. |
| platonic-ts MCP server (`outline`, `usages`, name-addressed edits) | 2 s first call, then ms | 1 smoke | — | 1 | watch | Not connected in this session yet (needs restart). Friction: entry points hardcode their own repo; wrappers written. Value to measure: tokens per navigation question versus Read and Grep. |
| Fence hooks (platonic-ts PreToolUse and pre-commit) | — | 0 | — | — | off | Not installed: project hooks would apply to every session in the checkout. |
| Standing per-fence commit grants (deviation from one-holder rule) | 0 | 0 | — | 0 | watch | Count `index.lock` collisions and any cross-fence staging. |
| `wave.json` manifest (fences as data) | — | 1 | — | 0 | watch | Only useful if something reads it (hooks off, gate `clean` step not wired). Drop if unused by wave 2. |
| Performance tests as `*.perf.ts` behind `npm run perf` | — | 0 | — | 0 | watch | PERF track is the first user. |
| Parallel-wave checkpoints and briefs | supervisor time | 10 briefs | — | 1 | keep | Friction: none from the format. The checkpoints were what made the stalled tracks resumable: S and M could be relaunched from their own notes without re-deriving anything. |
| Concurrent subagent count | — | 7 at once | — | 1 | watch | Seven subagents stalled at once on 2026-09-07 20:07; the user reports a disconnection on their side at that time, so the count is not shown to be the cause. Documented default limit is 20 (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`). Running seven again from 22:40. |

## Track reports

Transcribed from track checkpoints and final reports; "caught" is the track's own count of real defects.

| Track | tsc | ESLint (typed) | Escape-hatch rules | vitest |
|---|---|---|---|---|
| S synthetic (2026-09-07) | 14 runs, 6.7 s each, caught 2 real defects (one a silently ignored option), no false positives: helpful | 8 runs, 11.6 s each, caught nothing, more wall time than the other three combined; its live rules overlap the escape-hatch rule in a package with no async code: neutral, first candidate to drop | under 1 s, changed one design for the better (an intersection type instead of a cast): helpful | 78 tests, about 1 s, caught one issue in a test; building and stress suites passed first run, so their value is regression protection: helpful |

| W0 workflows fixtures (2026-09-07, Sonnet, documents only) | no code checks run; JSON parse check only, 10 of 10 pass | — | — | — |

| M model (2026-09-08) | caught 3 real design defects, 5 s warm: helpful | typed set, 13 s for 39 files, caught 3 defects, all in tests (`expect.closeTo` results typed any): helpful but the cost is the concern | under 1 s, found nothing because the constraint shaped the code; grep matches prose: neutral | 198 tests under 1.6 s, caught 4 real defects: best value per second | Strict settings (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`): keep both; optional properties on plain records need `?: T \| undefined`. |

| D0 fixture server (2026-09-08) | helpful; blocked for a while by missing `@types/node` (supervisor omission, fixed in `f31c931`) | typed set caught one thing tsc did not (`require-await` on a weak async test); 7.4 s typed versus 4.5 s untyped on this package, so the 8 to 28 s figure does not hold here: keep demos in the typed config | clean | 62 tests, about 1 s: helpful | Correction to the review log: the typed-lint saving on I/O packages is smaller than measured on synthetic, and it did catch one defect. |

| BIND bindings (2026-09-08) | clean | clean | 0 hatches | 28 tests plus 4 perf tests: helpful; one benchmark relationship flaked at 10k rows until repetitions rose to 25 | Process friction: `git commit -F -` at the head of a shell pipeline sent the message to the wrong process and held `.git/index.lock` for four minutes. Rule added: never pipe `git commit`; pass the message as a file. Perf-test relationships fail under machine load (two of Track PERF's uncommitted tests did); perf suites must run on a quiet machine or with wide margins. |

| I interact (2026-09-08) | helpful; 5 to 7 s alone, 75 s while other tracks compiled. The track believed the per-package tsconfig checks the whole workspace; the supervisor counted: 21 interact files plus 21 model files, nothing else, so the 75 s was CPU contention from eight concurrent tracks | 6 to 7 s, caught nothing tsc had not: neutral | grep scan caught two violations tsc and eslint accepted: helpful, needs a parser to stop matching prose | 202 tests, 0.5 to 1.4 s, 3 real defects: helpful | One commit waited about 36 s on another track's `index.lock`; explicit pathspecs kept the other track's staged files out. |

| M2 model bridges (2026-09-08) | 5 s, caught nothing this track: neutral | 14 s, caught nothing: neutral | clean | 224 tests, 1 s; the timing test caught a slow first implementation (whole-buffer pass 11.8 ms versus blocked transpose 4.1 ms): helpful | — |

| PERF instance updates (2026-09-08) | 15 s under load, caught one strict-mode defect in the stalled agent's code: helpful | 14 s, caught nothing: neutral | clean | 34 unit tests; 14 perf tests needed three protocol revisions to stop failing at random on a shared machine (interleaved rounds, 25 repetitions, assert on the fastest repetition); unstable assertions were removed rather than weakened: perf tests are helpful as measurements, fragile as gates | Perf tests must not be part of any gate that runs while other agents compile. |

| F formats (2026-09-08) | helpful | neutral | clean | 149 tests; the perf test found a 260 ms closure-allocation cost in a precondition helper: helpful | Git: `commit --amend` without a pathspec swallowed another track's staged files. Rule: never amend in the shared checkout. |

| S2 generators (2026-09-08) | 3 real defects: helpful | 3 s, caught nothing tsc did not: neutral | clean | 212 tests, 1.2 to 3 s, 3 defects; JSON snapshots helpful for review: helpful | The W0 expected-result documents were worth more than any tool: eight design decisions came from them before adapters existed. Costliest minutes: assertions true for one seed only; fixed by placing cases structurally. Standing per-fence commit grants let an `index.lock` refusal plus another track's amend misattribute four files; the discipline of pathspecs held, the grant model did not. |

| R render (2026-09-08) | about 20 runs, 13 s, 6 real defects (two unchecked-index misses that would have thrown): helpful | untyped set, 12 runs, 12 s, 0 defects in 5,759 lines: neutral, keep only for what tsc cannot express | forced -1 sentinels and empty returns instead of `!`; `?? 0` about 120 times in hot loops, not measurable against memory traffic: helpful with a cost | unit 4 s, 214 tests, 2 defects: helpful; perf suite: highest-value check in the track, caught two 9× and 300× costs no unit test could, but three runs were dominated by harness noise before the protocol settled | Writing the perf suite right after the first chunk was the best decision in the track. `cd` inside a compound command broke a later relative pathspec: run git from the repository root. |

| M3 model additions (2026-09-08) | 6 s, clean: neutral | 10 s, clean: neutral | clean | 239 tests, 1.1 s: helpful | Downstream read-only typechecks (formats, synthetic) were the check that proved additivity. |

| W workflows (2026-09-08) | clean | clean | clean | 121 tests; the exact-match tests against hand-written expected files caught a schema that silently passed extra columns through, which tsc could not see: helpful | Sonnet sub-workers (3) produced six adapters; lead review found four honesty gaps in them and one in the lead's own work found by a worker. Sonnet for adapters works with a reviewing lead, not without. |

| T testing tools (2026-09-08) | clean | clean | clean | 133 tests, 6.8 s quiet, 28 s under load: helpful | Browser tests skip with a reason when no browser launches rather than failing; machine load, not the runner, is the browser cost (4 s versus 147 s). |

| F2 formats (2026-09-08) | clean; the downstream render typecheck caught M4's in-flight unused import, correctly attributed | clean | clean | 155 tests; perf run twice: helpful | Whole-load numbers moved 12 to 16% between runs on a loaded machine; only the step that changed is a claim. |

| R2 mesh table (2026-09-08) | 1 real defect (an unsound spread of an optional field): helpful | render 68 s under load, 0 defects, seventeen times the test suite: hindrance at this size | clean | render 243 tests in 4 s; testing 136 in 27 s, 20 s of it fixture building: helpful | Downstream typechecks passed while the default format drew nothing; only a form-specific test caught it. |

| M4 model (2026-09-08) | 6 to 8 s; the downstream typechecks were the check that proved non-additivity of the bounds fact: helpful | 10 s quiet, 95 s under load, the only gate that varied tenfold: neutral | clean | 260 tests; caught `mapped` inside `object()` doing nothing and an aspect that only reached the perspective path, both invisible to the compiler: helpful | — |

| E2E slice (2026-09-08) | clean | clean; typed set on demos clean | clean | 17 tests: helpful; the screenshot was the only check that caught the page failing its purpose twice (doors hidden inside walls; ghosting not helping): a browser screenshot is a gate for anything visual | Another session's failing test appeared in the package mid-run; per-path test runs kept the track's own result readable. |

## Review log

- 2026-09-07, lint switched to untyped rules (user decision after measurement). Measured on the synthetic package with six agents loading the machine: type-aware rules 7.7 to 28 s per package, 18 s for a single file, no gain from `--cache`, because the rule set rebuilds a TypeScript program on every run; untyped rules 2.4 s per package and 2.8 s for all six V2 packages. Track S reported 8 typed runs that caught nothing while tsc caught two real defects. New rules: `viewer/eslint.config.js` is the untyped `recommended` set plus `no-explicit-any` and `no-unused-vars` over every V2 package and runs in `npm run lint` and the check wrapper on every chunk; `viewer/eslint.typed.config.js` is the type-aware set with `no-floating-promises` over the I/O packages (demos, mcp, viewer) and runs as `npm run lint:typed` at wave integration only. Both files carry the reason in their header comment. Also added `@types/node` to the workspace, which the fixture server needs and which the typed lint could not resolve without.

- 2026-09-07, wave 0 start: the Agent tool cannot message a running subagent in this session (SendMessage disabled), so the three wave 0 tracks were not told to keep a "Tooling" section; their reported command runs and results are transcribed here by the supervisor instead. Every later brief includes the section.
- 2026-09-07, wave 0 start: ledger created after the retrofit. No V2 code exists yet, so no check has caught anything; the two friction incidents are both ratchet-related and both fixed in the wrapper.
