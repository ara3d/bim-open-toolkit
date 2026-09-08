# Capture

**Question.** Give me a picture for the report.

**Basis.** Synthetic. The model is the `building` fixture from `@bim-open-toolkit/synthetic`.

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
not in the picture at all.

**The picture is not a screenshot.** A capture is an encode of the model canvas. The heads-up
display, the capture bar and the property sheet are drawn on their own canvases above it, so none of
them appears in the file. The demo opens with the readout shown to make that visible: turn it off and
on, take a picture either way, and the file is the same size and the same picture.

**Limitations.**

- The time a capture took is not in the sheet. The capture slice records the picture, its size and
  its format, and nothing about how long it took; printing a number the document does not hold would
  be an invention. The request to add it is in `CHECKPOINT-D2.md`.
- The demo declares the target-less capture feature, which stores an image somebody else encoded and
  refuses a request to draw one. The gallery has the renderer and has to install the capture feature
  with it; the request is in `CHECKPOINT-D2.md`. Until then, pressing Capture reports
  `capture/no-target` rather than producing a file, which is the honest failure rather than a blank
  picture.
- The bar's buttons are a part defined in `panels.ts` because the `ui-gratify` widget kit has not
  been published.

**Reset.** Disposing what `start` returns puts the heads-up display back the way it was and forgets
this demo's stored picture, so the scene document is left as it was found.

**Verification.**

```
npx vitest run --root packages/demos test/demos/capture
```
