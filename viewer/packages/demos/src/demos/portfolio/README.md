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
the fixture server, rolled up by the grouping the file itself records. This is a different question
from the estate's, and the demo says so rather than dressing one up as the other.

The estate's question is which building is the outlier, and its interesting failure is a source
document that names no building or several, so a figure cannot be attributed. Snowdon cannot be asked
that. It is one building; the file declares no building and no site, and reading a block name out of
a level label would be an inference, not a record. And every one of its 51,139 objects names exactly
one of its seven source documents, so there is nothing left to disambiguate.

What the file does record is a grouping of its own: the seven discipline models federated into it —
architectural, plumbing, electrical, structural, HVAC, facades and site. So the question here is
**which source document records the most floor area, and can I drill into one.** Same shape as the
estate's — a roll-up you can drill into, with what could not be added up still visible — about a
grouping the file states rather than one this demo invented.

`runPortfolioDrillThrough` is not run over it. Its input is buildings, the documents that report
figures about them, and one figure per document; feeding it here would mean entering a source
document as a building and then again as a document naming that one building, a bijection the file
does not state, in a table whose `buildingId` column would hold a document title. Its rules are
applied instead — one unit per total, no total rather than a total of zero, nothing added across
units — over the rows the file has, and its `Outcome` colouring and set names are reused unchanged.

`_shared/snowdon.ts` names `snowdon.bfast`, the geometry-only export. That file carries no BOS tables
at all, so every one of its objects loads unnamed and uncategorised and there would be no parameter
table to roll up; this demo names the BIM export instead, which `_shared/snowdon.ts` documents as the
one with the full tables.

## What the file says, measured

Read through `loadModel(url, { properties: true })`: 1,620,524 parameter rows decoded, none dropped,
and every object attributed to one of seven documents.

| Source document | Floor area | Objects recording it |
|---|---|---|
| Snowdon Towers Sample Architectural | 784,962.07 `SQUARE_FEET` | 11,848 of 21,652 |
| Snowdon Towers Sample Site | 462,669.06 `SQUARE_FEET` | 91 of 2,014 |
| Snowdon Towers Sample Structural | 178,984.04 `SQUARE_FEET` | 387 of 4,425 |
| Snowdon Towers Sample HVAC | 56,609.16 `SQUARE_FEET` | 2,664 of 4,354 |
| Snowdon Towers Sample Electrical | 53,351.68 `SQUARE_FEET` | 1,986 of 7,244 |
| Snowdon Towers Sample Facades | 53,265.23 `SQUARE_FEET` | 350 of 2,267 |
| Snowdon Towers Sample Plumbing | 44,475.74 `SQUARE_FEET` | 6,447 of 9,183 |
| **Whole file** | **1,634,316.98 `SQUARE_FEET`** | **23,773 of 51,139** |

`SQUARE_FEET` is the unit the exporter recorded, carried through and never converted. The other
counts the demo reports are the ones that keep the total honest:

- **27,366 objects record no `Area` at all.** They are counted as recording none. None of them is
  added in as a zero, and the model is coloured by the difference: green where an area is recorded,
  amber where none is.
- **4,615 of the 23,773 record an area of exactly zero.** A recorded zero is a different answer from
  no measurement, so it is counted apart and stays inside the total.
- **0 objects name no source document.** The count is stated because it was checked, not because it
  is interesting on this file.
- **`Volume` gets no total.** The file records it in two units — 17,532 rows in `CUBIC_FEET` and 40
  in `US_GALLONS`, all forty in the plumbing model. Nothing is converted, so there is no single
  number, and the sheet shows both totals as a disagreement instead.

## What is shown

The site plan opens with the workflow already applied. Each building carries a card over the top of
its mass giving its name, its site, the figure the workflow could attribute to it, the outcome it
was coloured by, and whether anybody surveyed it. Clicking a card drills into that building: the
rest of the estate leaves the picture, the building is selected, the camera frames its own box and
the sidebar narrows to it. Clicking the card again comes back out to the whole estate.

The sidebar shows the estate's counts, every document by name with what it maps to, the metrics that
resolved, the site rollup, and the exceptions table.

On Snowdon Towers the estate's cards are gone — there is no building of the estate for them to be
about — and a panel in the top-left corner lists the seven source documents, largest floor area
first, each with what it adds up to and how many of its objects record it. Clicking one drills into
that document: only its objects stay in the picture, the camera frames their box, and the sidebar
narrows to it. Clicking it again comes back to the whole model. The model itself is coloured green
where an area is recorded and amber where none is.

The sidebar gives the roll-up and its counts, the total per source document, the quantities that
could not be totalled with every unit each was recorded in, the counts read off the object records,
and the ten largest categories. A file whose format carries no parameter table gets neither panel nor
colouring, and the sheet says what a roll-up would need and that this file does not carry it.

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
- A source document's box is the box of what it draws. An object that draws nothing is left out of
  it rather than given the point its own record sits at: a model read from a BFAST file leaves every
  record at the identity, because the real placement is on the instance rows, so that fallback would
  stretch every document's box from the building to the world origin. Of Snowdon's 51,139 objects
  25,675 are drawn, so the colouring is a picture of half the model; the other half is counted in the
  sidebar and in the report.
- Drilling into a source document isolates its objects and frames them; it does not select them. A
  selection of twenty-one thousand objects is not something a property sheet can show.
- Which source document is drilled into is held beside the subject rather than read back out of the
  isolation. A building is one object, so the estate can read its drill out of what is isolated; a
  document is tens of thousands, and scanning them per frame is not worth it.
- Snowdon Towers is a hundred-megabyte file that is never committed. Everything the demo does with a
  model it did not generate is tested without it: `recorded.test.ts` builds parameter and document
  tables by hand and puts them through the formats package's own decoders, and `snowdon.test.ts`
  checks the same code against the real file and skips itself, by name, when the file is not there.

## Reset

Disposing the demo dispatches `overlays.clear` for its own layer, `appearance.clear` and
`sets.clear`, which takes back the labels, the colouring, the two named sets, any isolation and the
selection. The camera is left where the reader put it.

## Verify

```
npx vitest run --root packages/demos test/demos/portfolio
```
