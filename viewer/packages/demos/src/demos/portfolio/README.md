# portfolio — Portfolio drill-through

## The question

Which building in the estate is the outlier, and can I drill in?

## The basis

Two fixtures, each stating what it is.

**Synthetic estate (default).** The estate comes from `@bim-open-toolkit/synthetic`'s `generateCity`
at its default options: two sites of three buildings, each with a geographic anchor except one that
nobody surveyed, plus the documents that report figures about them. Nothing here is read from a real
project, and no figure is derived from geometry.

The result comes from `@bim-open-toolkit/workflows`' `runPortfolioDrillThrough`. That adapter's one
rule is that a source document is not a building: a figure is attributed to a building only through
a document that names exactly one. The demo does not second-guess it. Every colour, set, label and
count on the page is read back off the result rather than derived again here.

**Snowdon Towers (source-backed, opt-in).** The real building, read from `snowdon-bim.bfast` through
the fixture server. Opening it runs no workflow, draws no card and shows no figure. It is one
building, and the drill-through's three inputs are none of them readable out of it:

- **No building and no site.** The file declares levels, areas, rooms and spaces. Nothing in it is a
  building, and reading a block name out of a level label would be an inference, not a record.
- **No document attribution.** The file records which of its seven source documents each object came
  from — the architectural, facades, structural, plumbing, HVAC, site and electrical models. An
  `ObjectRecord` does not carry that field, so nothing here can read it.
- **No reported figure.** Quantities, `Area` in square feet among them, live in the file's BOS
  parameter tables. `@bim-open-toolkit/formats` does not decode them and `LoadedModel` does not
  expose them.

So the sheet says what the file does carry — its objects, how many are named, categorised, carry a
source id and are drawn, and its largest categories — and then names each of the three gaps with the
reason. Each is a request to the formats track, not a gap to fill in here. Deriving an estate around
the one real building, or attributing the generated estate's figures to it, would be the fabrication
the gallery forbids.

`_shared/snowdon.ts` names `snowdon.bfast`, the geometry-and-parameters export. That file carries no
BOS tables at all, so every one of its objects loads unnamed and uncategorised; this demo names the
BIM export instead, which `_shared/snowdon.ts` documents as the one with the full tables.

## What is shown

The site plan opens with the workflow already applied. Each building carries a card over the top of
its mass giving its name, its site, the figure the workflow could attribute to it, the outcome it
was coloured by, and whether anybody surveyed it. Clicking a card drills into that building: the
rest of the estate leaves the picture, the building is selected, the camera frames its own box and
the sidebar narrows to it. Clicking the card again comes back out to the whole estate.

The sidebar shows the estate's counts, every document by name with what it maps to, the metrics that
resolved, the site rollup, and the exceptions table.

On Snowdon Towers there are no cards and no colouring: the model is drawn and framed, and the
sidebar gives the counts read off its object records, the three things the drill-through needs with
the reason each is absent, and the ten largest categories the file names.

## The gaps it shows, and why

- **A campus report that names two buildings.** Its figures are attributed to neither. The sheet
  shows the document as a disagreement listing both candidates; the workflow raises one exception
  per figure it carries.
- **A survey nobody has filed.** `doc-unmapped` names no building at all. It stays in the documents
  list, by name, marked as unmapped. Dropping it would hide the fact that somebody has a report and
  nobody has decided what it is about.
- **A site with no rollup.** Every figure reported about the last site is either disputed or absent,
  so that site has no rollup row. It is not a total of zero; a total of zero would be a claim.
- **A building nobody surveyed.** Its registration reads as missing with the reason, rather than
  being placed at the origin of a map.

## Limitations

- The estate is generated once when the demo module is imported, because a card exists per building
  and the panel list is part of the demo's registration. The default estate is six boxes, so this
  costs a few milliseconds.
- The cards are built from Gratify's own `Stack`, `Row` and `Label`. Track UG's `Card`, `Chip` and
  `Tag` widgets, with their leader lines, had not landed; the swap is recorded in
  `demos/docs/CHECKPOINT-D4.md`.
- Drilling in is isolation, not a second model load. The estate is one model; there is no
  higher-resolution building behind a card.
- The workflow states no camera, so the saved view it ends at keeps the camera the page is already
  on. The demo frames the estate itself when it opens.
- Which fixture is open is recorded by `start`, which is the one place the contract hands a demo the
  models it opened; `ready`, `report`, the inspector and a card's placement are all handed a
  `Session`, and a session does not say which model is behind it. `resetPortfolio` puts it back.
- Snowdon Towers is a hundred-megabyte file that is never committed. Everything the demo does with a
  model it did not generate is tested on generated data; the one test that needs the real file skips
  itself, by name, when the file is not on the machine.

## Reset

Disposing the demo dispatches `overlays.clear` for its own layer, `appearance.clear` and
`sets.clear`, which takes back the labels, the colouring, the two named sets, any isolation and the
selection. The camera is left where the reader put it.

## Verify

```
npx vitest run --root packages/demos test/demos/portfolio
```
