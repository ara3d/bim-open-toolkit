# portfolio — Portfolio drill-through

## The question

Which building in the estate is the outlier, and can I drill in?

## The basis

Synthetic. The estate comes from `@bim-open-toolkit/synthetic`'s `generateCity` at its default
options: two sites of three buildings, each with a geographic anchor except one that nobody
surveyed, plus the documents that report figures about them. Nothing here is read from a real
project, and no figure is derived from geometry.

The result comes from `@bim-open-toolkit/workflows`' `runPortfolioDrillThrough`. That adapter's one
rule is that a source document is not a building: a figure is attributed to a building only through
a document that names exactly one. The demo does not second-guess it. Every colour, set, label and
count on the page is read back off the result rather than derived again here.

## What is shown

The site plan opens with the workflow already applied. Each building carries a card over the top of
its mass giving its name, its site, the figure the workflow could attribute to it, the outcome it
was coloured by, and whether anybody surveyed it. Clicking a card drills into that building: the
rest of the estate leaves the picture, the building is selected, the camera frames its own box and
the sidebar narrows to it. Clicking the card again comes back out to the whole estate.

The sidebar shows the estate's counts, every document by name with what it maps to, the metrics that
resolved, the site rollup, and the exceptions table.

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

## Reset

Disposing the demo dispatches `overlays.clear` for its own layer, `appearance.clear` and
`sets.clear`, which takes back the labels, the colouring, the two named sets, any isolation and the
selection. The camera is left where the reader put it.

## Verify

```
npx vitest run --root packages/demos test/demos/portfolio
```
