# Capture

**Question.** Give me a picture for the report.

**Basis.** Source-backed. The demo opens Snowdon Towers, read from `/fixtures/snowdon.bfast` by the
gallery's dev server; the generated building is the second entry in the picker, for a machine that
does not have the file.

**The demo opens with a picture already taken.** `start` shows the readout and then draws one
picture at the report size through the viewer, and stores it with `capture.image` in its `store`
form. The viewer is the only thing here that has a renderer, so it is the thing that draws; the
capture feature this demo declares has none. A picture that could not be drawn does not stop the
demo: the reason is kept and both the sheet and the report say it, so an empty picture is never
reported as a picture.

**What the widget shows.** A bar in the top-left of the viewport: three sizes (Report 1600×1000,
Slide 1280×800, Thumbnail 480×300), a Capture button and a HUD switch, with a line underneath saying
how big the last picture is and how many bytes it took. Pressing Capture dispatches `capture.image`
at the chosen size; the capture feature draws, encodes and stores the picture in the scene document,
and the bar reads it back on the next change event. The bar never holds a picture of its own, so
what it reports is what was actually stored.

**Sizes are stated in pixels.** There is no "current viewport" option, because the viewer tells a
demo how to take a picture but not how big the view is, and a stored record has to say how big the
picture is. A size the demo cannot describe is not a size it offers.

**What the inspector shows.** The last picture's size, width, height, byte count and format; and,
under "What is in the frame", whether the heads-up display is shown and the fact that the panels are
not in the picture at all. When there is no picture the row says why: nobody asked for one, or the
reason the renderer gave for not drawing it.

**The picture is not a screenshot.** A capture is an encode of the model canvas. The heads-up
display, the capture bar and the property sheet are drawn on their own canvases above it, so none of
them appears in the file. The demo opens with the readout shown to make that visible: turn it off and
on, take a picture either way, and the file is the same size and the same picture.

**Limitations.**

- The time a capture took is not in the sheet. The capture slice records the picture, its size and
  its format, and nothing about how long it took; printing a number the document does not hold would
  be an invention. The request to add it is in `CHECKPOINT-D2.md`.
- Pressing Capture does not produce a file. The demo declares the target-less capture feature, and
  `createGalleryViewer` installs a demo's features before its canvas exists, so nothing can give
  that feature the gallery's renderer: `capture.image` in its render form reports `capture/no-target`,
  which is the honest failure rather than a blank picture. The opening picture goes around it by
  drawing through `GalleryViewer.capture` and storing the result, which is the one path a demo has.
  The fix is in `createGalleryViewer`: make the capture target before installing the features and
  install `captureFeatureWith(target)` in place of a demo's `capture` feature. The request is in
  `CHECKPOINT-D2.md`.
- The gallery draws no panels. `Demo.panels` is in the contract and nothing under `src/gallery`
  reads it, so the bar this demo defines is not on the screen in the gallery at all; the panel is
  exercised by its tests until the host draws it.
- The bar's buttons are a part defined in `panels.ts` because the `ui-gratify` widget kit has not
  been published.

**Reset.** Disposing what `start` returns puts the heads-up display back the way it was and forgets
this demo's stored picture, so the scene document is left as it was found.

**Verification.**

```
npx vitest run --root packages/demos test/demos/capture
```
