# Proposal: five demo contexts for BIM Open Flow

> Written 2026-10-05 by Claude Fable 5.1 with Christopher Diggins, from a
> conversation about how to show the graph system's range without one
> "everything" demo. Status: accepted by the owner the same day; tickets
> TKT-165 to TKT-169 carry the work, and the first chunk (this document, the
> family page's "Five ways in" section, and `docs/DEMOS.md` grouped by
> context) is committed with it.

## The question

The notebook shows everything BIM Open Flow does in one place, which makes it
hard to see any one thing. The owner proposed showing the system in a few
targeted contexts instead: ETL, SQL-style data work, 2D and 3D visualization,
and "something with agents". This document says which contexts to build, how
to tell them apart, how to build them without forking the app, and in what
order.

## What exists today

The repository already half-does this.

| Surface | Context it serves | State on 2026-10-05 |
|---|---|---|
| `/duckdb.html`, `samples/duckdb-analyses` | analysis | Nine query graphs and an Ask box, all over the private Snowdon export; the public models have a different table vocabulary |
| `/3d.html`, `/showcase.html`, `samples/view3d-analyses` | 3D | Eight graphs over the Duplex IFC in the editor; seven hard-coded recipes over a Snowdon fixture in the lab; the two sets differ |
| `nrc-analyses/nrc-dc-w1-verdicts`, the Compliance, Evidence, and Reports packs | checking | One door check from IFC to verdicts, 3D, chart, and report; the report stays pending because the editor cannot Run (TKT-12) |
| `samples/showcase-analyses`, the Effects pack, TKT-66 | pipelines | Readers for every format; writers exist but never execute (TKT-12) |
| `/nrc.html`, `docs/nrc-walkthrough.md`, `samples/nrc-analyses` | research | The paper's eight answers, hashed runs, byte-exact write-back; presented as a work log, not a demo |
| `bench/ifc-bench` in bim-open-data, TKT-145 | agents | One hundred IFC-Bench questions scored; no bare-session arm yet (workflow 5) |

Two host profiles exist, `bim` and `tables` (`StudioComposition.cs`), and
a profile already decides packs, seeded samples, and background preparation.
Node cards carry a pack colour. The three guide files under
`.claude/skills/bim-flow/` are the Ask box's system prompt. The start page's
template catalog is generated from the sample folders
(`scripts/build-flow-templates.mjs`).

## The contexts

Split by the person, not the technique. ETL and SQL are both "tables in,
tables out" by the brief's principle 5; what differs is who is looking and
what they call a result.

| Context | Who | What they call a result | Page | Ticket |
|---|---|---|---|---|
| **Analysis** | an analyst or BIM manager with a question | a table and a chart, with the query behind them | `/duckdb.html` | TKT-165 |
| **3D** | a BIM coordinator reviewing a model | a coloured, sectioned, or exploded view driven by data | `/showcase.html`, `/3d.html` | TKT-166 |
| **Checking** | a BIM manager auditing a delivery | verdicts, a model coloured by verdict, an evidence report | new page or start-page group | TKT-167 |
| **Pipelines** | a data engineer feeding other systems | files on disk and a run record that names them | new page | TKT-168 |
| **Research** | a researcher reproducing a published result | the paper's numbers, pinned by content hash | `/nrc.html` | TKT-169 |

**Agents are not a sixth context; they are a second axis.** The brief makes
Claude the first user, so each context gets a "by hand" run and an "in Claude"
run of the same graphs. One agent demo stands alone: the benchmark of
workflow 5, where the toolkit arm beats a bare session on correctness, time,
and tokens. That is the agent story with a number on it, and TKT-145 is its
first half.

Not added: geometry analytics (bounding boxes, clash candidates, volumes)
belongs inside 3D and checking rather than beside them; dashboards and
documents are an output of analysis and checking, not an audience.

## One app, several profiles

Nothing forks. A context is:

1. a **profile**: the pack set and the sample roots it seeds (`HostProfile`);
2. a **landing page** with one paragraph naming the audience, and the demo
   page it opens;
3. **three to five sample graphs** over a public building, each with a test
   that asserts its numbers;
4. a **template group** on the start page, generated from the sample folder;
5. an **Ask prompt**: the shared guides plus one file of context-specific
   vocabulary and examples.

Branding per context is a colour and a noun on the landing page and the
template group, in the family's existing palette (`docs/BRANDING.md`). The
engine, editor, panes, and documentation stay shared.

Every context runs over the public buildings in bim-open-data's
`samples/public` (Schependomlaan, DigitalHub, Duplex; TKT-144 settled their
licences), never the private Snowdon model, so each demo opens from a clean
clone and, later, from the public pages (workflow 1).

## What each context asks of the other repositories

Building a demo is the fastest way to find what a dependency lacks. Each
context's builder files what it finds in the dependency's own repository and
notes the ticket id in the context ticket here.

| Context | Likely asks | Repository |
|---|---|---|
| Analysis | peek and describe over BOS views, a guide for the text-view vocabulary, `duck.*` over several files | bim-open-flow, bim-open-data |
| 3D | one colour domain and legend across panes (TKT-16), selection sync, the 3D pane inside the DuckDB studio (TKT-28) | bim-open-viewer, this repository |
| Checking | rule parameters as node controls (TKT-23), IDS evaluation (TKT-50), a verdict colouring node | bim-open-flow, this repository |
| Pipelines | Run from the editor (TKT-12), GLB and BOS sinks (TKT-66), Parquet and XLSX writers, a run record viewer | bim-open-flow, bim-open-data |
| Research | nothing new; a presentation of what exists | bim-open-notebook |
| Agents | catalog descriptions good enough for a cold model, the bare arm of the benchmark | bim-open-flow, bim-open-data |

## Order

Analysis first: the surface is built, the Ask box works, and it serves
workflow 2, which the brief ranks highest. 3D second: it is the context no
other tool offers. Checking third: it reuses the NRC chain and is the most
legible "why a graph and not a script" argument. Pipelines after TKT-12
lands, since a pipeline demo whose writers never write proves nothing.
Research is a presentation chunk that can run at any time.

Five contexts is the ceiling. Each one is a sample folder, a test, a page,
and a template group to keep green; a sixth would need a workflow in the
brief that none of the five serves.

## Chunks

1. **This document, the family page, `docs/DEMOS.md`.** The public page gains a
   "Five ways in" section that names each context, its audience, and the demo
   that exists today; `docs/DEMOS.md` gains a table of demos by context.
   Committed with this proposal.
2. **TKT-165, analysis.** Rewrite or add five `duckdb-analyses` graphs over a
   public `.duckdb`, a test for their numbers, a page paragraph, templates,
   and one committed Claude transcript per graph.
3. **TKT-166, 3D.** The lab opens a public model and each recipe is a sample
   graph that `3d.html` also opens.
4. **TKT-167, checking.** Three checks over a public building, each a verdict
   table, a colouring, a chart, and a pending report.
5. **TKT-169, research.** `/nrc.html` as a reproducibility demo.
6. **TKT-168, pipelines.** After TKT-12.
7. **Agents.** The bare arm of the benchmark (workflow 5), as its own ticket
   when TKT-145's owner decisions are made.

## Open questions

- TKT-4, the user-facing noun. The landing pages need it; "analysis" as the
  saved thing and "graph" as its structure is the default.
- Whether checking gets its own page or a group on the studio start page. The
  default is a start-page group, because a page per context multiplies
  chrome; the ticket decides when the samples exist.
- Whether the public pages can open the analysis and 3D demos with no host
  (TKT-163). Until then the pages link to the sample notebooks, which already
  open with nothing installed.
