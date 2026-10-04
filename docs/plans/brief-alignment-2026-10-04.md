# Brief alignment interview, 2026-10-04

Status: done. `PROJECT.md` was rewritten from this interview the same day. Kept as the record of what the owner said, so a later reader can tell a decision from an inference.

## Why

The first brief (2026-09-26) was written unattended from forty documents and checked by four read-only lenses. Those lenses check the brief against the code. Nothing checked it against what the owner wants, and the owner's reaction was that it was too specific (Snowdon numbers in four of five success lines), too low-level (files and ports in every Today line), and that it did not say the goals were clear. This interview tried a procedure for that gap, to be written into `make-platonic` as an `align` phase if it works.

## Procedure

1. **Elicit before showing.** Five open questions, answered without the brief on screen: the next stretch, who it is for, the demo you dread, what you would stop, the one number for a slide.
2. **Diff.** Each brief line classified against the answers: contradicts, absent from the answers, absent from the brief, matches.
3. **Forced choices.** Three rounds of at most four multiple-choice questions, the brief's position one option among others that would change the work.
4. **Rewrite,** run `check_brief.py`, close or file the tickets, record the interview here.

What worked: the blind elicitation surfaced the notebook-in-Claude goal, scripting, and the credits fear, none of which the forty documents held. The diff made the contradictions (scripting Out, Snowdon everywhere) visible in one list. Three rounds of four questions were enough; the fourth round would have been about Done-line wording, which the draft settled.

## The owner's answers, step 1

The project should let people work with BIM models efficiently through an LLM; connecting Claude should let them create workflows, answer questions, and gain insight in multi-modal form (charts, graphs, pictures, renders, 3D, infographics, tables, databases, files). Stand out on capability, ease of use, scalability, efficiency. Next: smoother Claude integration, easier setup, rendering, delegating to Claude work it can already do, people writing and executing scripts, extending the node libraries. Users: BIM managers, architects, engineers, data scientists, software developers, who create documents and artifacts to share. Embarrassing: not understanding what the system did, how to use it, or what its output means. Fear: polishing the wrong things, low-priority work, long idle runs burning credits, unclear goals. Measurement: unknown how, but clearly more efficient at answering questions and doing tasks would be the claim. The existing brief is too specific (Snowdon) and too low-level.

## Decisions, steps 3 and 4

| Question | Decision |
|---|---|
| Scripting, which the brief had as Out | In, as the way a person or Claude makes a new node; not a general scripting API |
| The rule check (old W5) and the NRC paper reproduction (old W6) | Kept and tested under Scope In; no longer workflows that drive priorities |
| Snowdon | Only as the scale test, one success line |
| First user when users conflict (TKT-1) | A BIM professional working through Claude; ticket closed |
| What "delegate work to Claude" means | All of: a whole task from one prompt, developer chores, operating the studio; and an integration inside Claude that feels like a notebook with inline views |
| Outputs the next stretch must deliver | Rendered images, shareable documents, charts and tables in the studio, infographics and dashboards; and a notebook another person opens locally or online |
| Measuring against existing ways of working | Same model with and without the toolkit, scoring correctness, time, and tokens on a committed set |
| Principle 8, "the AI produces data, never verdicts" | Dropped |
| Claude surface | Claude Code desktop app and the studio's Ask box; not claude.ai connectors in this stretch |
| What the brief covers | The whole family of repositories, from the toolkit |
| Setup target | Public pages for looking, one install for working |
| A principle about how work is chosen | Yes, in the brief (principle 9) |

## Workflow renumbering

Tickets filed before 2026-10-04 cite the old numbers. Old W1 (clean clone and Snowdon) is new W1 without Snowdon. Old W2 (Ask) is new W2. Old W3 (chart and export) and old W4 (3D) are new W3. Old W5 (rule check) and old W6 (NRC paper) are Scope In lines, not workflows. New W4 (scripts and packs) and new W5 (the benchmark) are new.

## Left open

- TKT-162: the language and runtime of script nodes. Blocks new W4.
- TKT-163: whether "open a notebook online" needs a hosted host.
- TKT-4 and TKT-21, unchanged.
- The Snowdon-size success line is marked `(unconfirmed)`: the budgets are not set.
- The old brief's two unconfirmed lines: principle 8 was dropped, and principle 9 (start from data, not a blank canvas) was dropped as a principle but survives as the template gallery ticket TKT-14.
