# BimOpenFlow branding

Decided 2026-10-03 by Christopher Diggins from proposals drafted with Claude
Fable 5.1 (the explorations are kept under `docs/brand/explorations/`). This
is the reference for the mark, the wordmark, the fonts, and the colours of
every BimOpenFlow page. Both looks carry it: the studio page
(`docs/proposals/studio-look.md`) and the classic pages (`/`, `/3d.html`,
`/duckdb.html`, `/showcase.html`), which share the mark through
`bimopenflow/web/packages/app/src/brand.ts` and the faces through their
stylesheets.

## The mark: Rows to Flow

![Rows to Flow](brand/mark.svg)

Three table rows on the left; their wires curve and gather into one solid
node on the right. It says what the product does: rows of building data
become a flow that ends in an answer. The file is `docs/brand/mark.svg`, a
24 by 24 viewBox, one path, one fill, so the path can be pasted into code
(the studio's command bar draws it as an inline SVG from a path string) and
scaled without edits. The lockup with the wordmark is `docs/brand/lockup.svg`.

Rules:

- One colour. Accent blue (`#2f66ce`) on a light surface; white on the
  accent or on a dark surface. No gradients, no outline, no shadow.
- Sizes: 16 px (favicon and browser tab), 22 px (command bar, beside the
  wordmark), 48 px (start page), 96 px and up (papers, slides). Below 16 px
  use the node alone (the circle), not the whole mark.
- Clear space of half the mark's width on every side.
- Do not rotate, skew, add rows, or recolour the rows and the node
  separately.

Known weakness: in a crowded tab strip the silhouette can pass for a
generic merge icon. The lockup, or the accent colour alone in a sea of
grey favicons, is what carries it.

## Fonts

| Role | Face | Weights | Where |
|---|---|---|---|
| Wordmark and page headings | Instrument Sans | 600, 700 | "BimOpenFlow" at 15 px bold beside the mark; flow titles at 18 px; start-page headings |
| Interface | Public Sans | 400, 500, 600 | Buttons, tabs, step rows, tables, the Ask box, body text, 11 to 13 px |
| Monospace | Fira Code | 400, 500 | Node ids, parameter lines, row counts and numbers in tables, SQL, Ask tool lines |

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
for the flow title, 20 px for a start-page heading. Weight 600 marks
titles and button labels; weight 500 is for emphasis inside text.

## Colours

| Token | Value | Use |
|---|---|---|
| Accent | `#2f66ce` | The mark, the primary button, selection, active tab |
| Accent soft | `#e8eefb` | Selected row, hover on cards |
| Text | `#171a1f` | Headings, body |
| Dim | `#5a606c` | Secondary text, ids, meta |
| Surface | `#ffffff` | Panels, cards, the command bar |
| Background | `#f4f5f7` | Page and canvas |
| Border | `#e3e6ea` | Dividers; `#cfd4db` for control edges |
| Status | green `#16a34a`, amber `#d97706`, red `#dc2626` | Ok, pending or unready, error |

Node packs on the canvas keep their own stripe hues (teal for sources,
blue for table work, purple for geometry, orange for views, red for
writers, green for checks; `canvasTheme.ts`, theme `studio`). They are a
data vocabulary, not brand colours, and do not appear in the chrome.

## Applying it

- Done in the app package: `brand.ts` holds the mark path and draws it
  for both chromes; every page head loads the three faces and the favicon;
  `styles.ts` (classic) and `studio/studio.css` (studio) name the stacks as
  `--bof-app-font`, `--bof-app-font-brand`, `--bof-app-mono` and
  `--s-font`, `--s-font-brand`, `--s-mono`; `public/favicon.svg` is the mark.
- A new page: copy the head links from `index.html` and use the tokens.
- Papers and slides: the lockup at 96 px or larger; body text in the
  document's own face, headings may use Instrument Sans.

## Alternatives recorded

`docs/brand/explorations/proposals.html` holds the first three marks
(Block Flow, Rows to Flow, Wired Block) and two font pairings;
`rows-to-flow-variations.html` holds six stylistic takes on the chosen
direction (Swiss grid, metro map, section drawing, terminal, O for Open,
isometric slabs), each with a note on where it is weakest, with the
monogram ranked best for favicon legibility and distinctiveness together;
`font-pairings.html` holds eight pairings rendered in the studio frame.
Each page loads its fonts from Google Fonts and needs no build step. If
the mark is revisited, start from the monogram (`mark-2e-monogram.svg`) or
the Swiss grid (`mark-2a-swiss.svg`), which were the strongest at 16 px.

`notebook-proposals.html` (2026-10-03, undecided) proposes the sibling
brand for BIM Open Notebook: three marks drawn with the same parts as Rows
to Flow (Flow to Page, Ribbon Page, an N monogram), four accent
candidates beside the flow blue, the family lockup "BIM Open Notebook",
and a notebook page set in the three faces above. Fonts, neutrals, status
colours, and the mark rules are shared with this guide; only the mark and
the accent are the notebook's own.
