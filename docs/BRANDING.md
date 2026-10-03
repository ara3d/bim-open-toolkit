# BIM Open branding

Decided 2026-10-03 by Christopher Diggins from proposals drafted with Claude
Fable 5.1 (the explorations are kept under `docs/brand/explorations/`). This
is the reference for the marks, the wordmarks, the fonts, and the colours of
every BIM Open page. Four products carry it: **BIM Open Flow** (the
graph editor and studio), **BIM Open Notebook** (the session record),
**BIM Open Viewer** (the 3D viewer), and **BIM Open Data** (the .NET
implementation of BIM Open Schema and the IFC stack); the
repository-layout proposal gives each its own repository. The studio
look (`docs/proposals/studio-look.md`) is the first page to carry it; the
classic page keeps its current look until the two are reconciled.

## The family

The products share everything except a mark and an accent:

| | Mark | Accent, soft | Lockup | Repository |
|---|---|---|---|---|
| **BIM Open Flow** | Rows to Flow, `docs/brand/mark.svg` | Flow blue `#2f66ce`, `#e8eefb` | `docs/brand/lockup.svg` | `ara3d/bim-open-flow` |
| **BIM Open Notebook** | Flow to Page, `docs/brand/notebook-mark.svg` | Ink violet `#5a47c7`, `#ece8fb` | `docs/brand/notebook-lockup.svg` | `ara3d/bim-open-notebook` |
| **BIM Open Viewer** | `docs/brand/viewer-mark.svg` | Teal `#0f8a80`, `#e2f3f1` | `docs/brand/viewer-lockup.svg` | `ara3d/bim-open-viewer` |
| **BIM Open Data** | Model to Rows, `docs/brand/data-mark.svg` | Rose `#b8326e`, `#f9e6ef` | `docs/brand/data-lockup.svg` | `ara3d/bim-open-data` |

The toolkit itself (`ara3d/bim-open-toolkit`) is the family hub and has no
accent of its own: its pages, such as the family landing page under
`site/`, use the text colour `#171a1f` where a product would use its
accent, and show each product in that product's accent.

Fonts, neutrals, status colours, the type scale, and the mark rules below
are the same for every product. A new product takes a mark drawn from
the same parts (the rows, the wire, the node disc) and an accent that no
other product or status colour uses.

## The names

The product names are three words: **BIM Open Flow**, **BIM Open
Notebook**, **BIM Open Viewer**, **BIM Open Data**. The one-word form "BimOpenFlow" was the wordmark until
2026-10-03 and remains in code identifiers, package names, and the
`bimopenflow/` directory, where it is a name for machines. Where a person
reads it, in a command bar, a page title, a paper, or a README heading,
write the three words.

The wordmark sets the family and the product in two weights: "BIM Open"
in weight 600 in the dim colour, then the product word in weight 700 in
the text colour, with a 4 px gap at 15 px. The family reads first, the
product second, and the two bars agree.

## The marks

![Rows to Flow](brand/mark.svg) ![Flow to Page](brand/notebook-mark.svg) ![Model to Rows](brand/data-mark.svg)

**Rows to Flow** (BIM Open Flow). Three table rows on the left; their wires
curve and gather into one solid node on the right. It says what the
product does: rows of building data become a flow that ends in an answer.

**Flow to Page** (BIM Open Notebook). The same node, now on the left; one
wire leaves it and joins the spine of a page, down which hang two short
lines and two wide blocks in turn: a request in plain language, then the
embed the agent answered with, then the next request. Read together, the
two marks say that the notebook is a client of the flow host and that an
answer becomes part of a document.

**Model to Rows** (BIM Open Data). Rows to Flow reversed: the node disc
on the left stands for a model, and three wires fan out of it to three
table rows on the right, each split into a key cell and a value cell. It
says what the library does: a building model, read from IFC or Revit,
becomes rows of plain tables.

Each file is a 24 by 24 viewBox, one path, one fill, so the path can be
pasted into code (the studio's command bar draws it as an inline SVG from
a path string) and scaled without edits.

Rules:

- One colour. The product's accent on a light surface; white on the
  accent or on a dark surface. No gradients, no outline, no shadow.
- Sizes: 16 px (favicon and browser tab), 22 px (command bar, beside the
  wordmark), 48 px (start page), 96 px and up (papers, slides).
- Below 16 px, Rows to Flow uses the node alone (the circle), Flow to
  Page uses the page alone (the spine and its rows), and Model to Rows
  uses the rows alone (the six cells), so the favicons differ even when
  the node is lost.
- Clear space of half the mark's width on every side.
- Do not rotate, skew, add rows, or recolour parts of a mark separately.

Known weakness: in a crowded tab strip Rows to Flow can pass for a generic
merge icon. The lockup, the accent in a sea of grey favicons, and now the
second product in a second hue beside it, are what carry it.

## Fonts

| Role | Face | Weights | Where |
|---|---|---|---|
| Wordmark and page headings | Instrument Sans | 600, 700 | The wordmark at 15 px beside the mark; flow and notebook titles at 18 to 20 px; start-page headings |
| Interface | Public Sans | 400, 500, 600 | Buttons, tabs, step rows, tables, the Ask box, body text, 11 to 13 px; notebook requests and replies at 14.5 to 15 px |
| Monospace | Fira Code | 400, 500 | Node ids, parameter lines, row counts and numbers in tables, SQL, Ask and notebook tool-call lines |

Why these three: Instrument Sans gives the wordmark and headings a voice
of their own without leaving the grotesque family the interface uses.
Public Sans was drawn for forms and tables, is plain and sturdy at 11 and
12 px, and suits a product whose output is a checkable schedule or a rule
verdict rather than a pitch. Fira Code has a clear 0 and O, 1 and l, and
ligatures for the arrows and comparisons that appear in SQL and in rule
parameters such as `<= 850`. All three are open licensed and served by
Google Fonts.

Loading, one line in the page head:

```html
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@600;700&family=Public+Sans:wght@400;500;600&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
```

Stacks, with the fallbacks a page without network should degrade to:

```css
--font-brand: "Instrument Sans", "Public Sans", "Segoe UI", system-ui, sans-serif;
--font-ui:    "Public Sans", "Segoe UI", system-ui, sans-serif;
--font-mono:  "Fira Code", "Cascadia Mono", Consolas, ui-monospace, monospace;
```

Type scale (interface): 11 px for parameter lines and meta, 12 px for
descriptions, 13 px for controls and body, 15 px for the wordmark, 18 px
for the flow title, 20 px for a start-page or notebook heading. Weight 600
marks titles and button labels; weight 500 is for emphasis inside text.

Type scale (notebook reading): a notebook is read, not operated, so its
prose is larger than the studio's controls. A request is 15 px weight 500;
a reply is 14.5 px weight 400 on a 1.55 line height and a 68-character
measure; the folded tool-call line is 11.5 px Fira Code. Embeds keep the
interface scale, so a table looks the same in a notebook and in the studio.

## Colours

| Token | Value | Use |
|---|---|---|
| Accent (Flow) | `#2f66ce` | The flow mark, the studio's primary button, selection, active tab |
| Accent soft (Flow) | `#e8eefb` | Selected row, hover on cards, in the studio |
| Accent (Notebook) | `#5a47c7` | The notebook mark, the notebook's primary button, selection, the turn rail |
| Accent soft (Notebook) | `#ece8fb` | Selected row, embed kind badge, in the notebook |
| Accent (Viewer) | `#0f8a80` | The viewer mark and the viewer's pages |
| Accent soft (Viewer) | `#e2f3f1` | Selected row and hover, in the viewer |
| Accent (Data) | `#b8326e` | The data mark and the data repository's pages |
| Accent soft (Data) | `#f9e6ef` | Selected row and hover, on the data pages |
| Text | `#171a1f` | Headings, body |
| Dim | `#5a606c` | Secondary text, ids, meta, the "BIM Open" half of the wordmark |
| Surface | `#ffffff` | Panels, cards, the command bar |
| Background | `#f4f5f7` | Page and canvas |
| Border | `#e3e6ea` | Dividers; `#cfd4db` for control edges |
| Status | green `#16a34a`, amber `#d97706`, red `#dc2626` | Ok, pending or unready, error; in the notebook, an embed whose re-evaluated result matches its snapshot (green) or differs from it (amber) |

A page uses one accent, its product's. Where the products meet, such as a
notebook embed that opens its graph in the editor, each side keeps its own.

Node packs on the canvas keep their own stripe hues (teal for sources,
blue for table work, purple for geometry, orange for views, red for
writers, green for checks; `canvasTheme.ts`, theme `studio`). They are a
data vocabulary, not brand colours, and do not appear in the chrome.

## Applying it

- Studio page: the mark replaces the cube path in
  `bimopenflow/web/packages/app/src/studio/studioChrome.ts`; the wordmark
  there and the `<title>` of `studio.html` and `index.html` change from
  "BimOpenFlow" to "BIM Open Flow" in the two-weight form; the font link
  goes in `studio.html`; the three stacks replace `--s-font` and `--s-mono`
  in `studio/studio.css`.
- Notebook page: the notebook mark and the violet accent, the two-weight
  wordmark "BIM Open Notebook", and the reading type scale above. Until
  the notebook repository exists, the assets live under `docs/brand/` and
  move with the code.
- Favicons: `docs/brand/mark.svg` served as `favicon.svg` from the app
  package; `docs/brand/notebook-mark.svg` from the notebook's page.
- Papers and slides: a lockup at 96 px or larger; body text in the
  document's own face, headings may use Instrument Sans.

## Alternatives recorded

`docs/brand/explorations/proposals.html` holds the first three flow marks
(Block Flow, Rows to Flow, Wired Block) and two font pairings;
`rows-to-flow-variations.html` holds six stylistic takes on the chosen
direction (Swiss grid, metro map, section drawing, terminal, O for Open,
isometric slabs), each with a note on where it is weakest, with the
monogram ranked best for favicon legibility and distinctiveness together;
`font-pairings.html` holds eight pairings rendered in the studio frame.
`notebook-proposals.html` holds the three notebook marks (Flow to Page,
Ribbon Page, an N monogram), four accents beside the flow blue (ink
violet, plum, ink, blue kept), three wordmark forms, and a notebook page
in the family type; its decision, made the same day, is the one above.
Each page loads its fonts from Google Fonts and needs no build step. If a
mark is revisited, start from the monogram (`mark-2e-monogram.svg`) or
the Swiss grid (`mark-2a-swiss.svg`), which were the strongest at 16 px.
