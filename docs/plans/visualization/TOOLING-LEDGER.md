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

## Review log

- 2026-09-07, lint switched to untyped rules (user decision after measurement). Measured on the synthetic package with six agents loading the machine: type-aware rules 7.7 to 28 s per package, 18 s for a single file, no gain from `--cache`, because the rule set rebuilds a TypeScript program on every run; untyped rules 2.4 s per package and 2.8 s for all six V2 packages. Track S reported 8 typed runs that caught nothing while tsc caught two real defects. New rules: `viewer/eslint.config.js` is the untyped `recommended` set plus `no-explicit-any` and `no-unused-vars` over every V2 package and runs in `npm run lint` and the check wrapper on every chunk; `viewer/eslint.typed.config.js` is the type-aware set with `no-floating-promises` over the I/O packages (demos, mcp, viewer) and runs as `npm run lint:typed` at wave integration only. Both files carry the reason in their header comment. Also added `@types/node` to the workspace, which the fixture server needs and which the typed lint could not resolve without.

- 2026-09-07, wave 0 start: the Agent tool cannot message a running subagent in this session (SendMessage disabled), so the three wave 0 tracks were not told to keep a "Tooling" section; their reported command runs and results are transcribed here by the supervisor instead. Every later brief includes the section.
- 2026-09-07, wave 0 start: ledger created after the retrofit. No V2 code exists yet, so no check has caught anything; the two friction incidents are both ratchet-related and both fixed in the wrapper.
