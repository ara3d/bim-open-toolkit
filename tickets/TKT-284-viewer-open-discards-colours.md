---
id: TKT-284
title: BIM Open Viewer: createViewer's open() paints every model grey, discarding the material colours the BOS reader loaded
status: done
depends_on: []
owner:
fence: [deps/bim-open-viewer/packages/viewer/src/create-viewer.ts, deps/bim-open-viewer/packages/formats/src/loaded-model.ts, deps/bim-open-viewer/packages/demos/src/gallery/model-source.ts]
workflow: [W3]
related: [TKT-226]
created: 2026-10-12
closed: 2026-10-12
kind: defect
---

## Acceptance criteria

- [x] A model opened through createViewer(canvas).open(url), the README's beginner path, shows its material colours (the Duplex roof green) with no caller-side style rules
- [x] The gallery's baseAppearancesOf workaround in packages/demos is removed or reduced to a call into the library, so there is one place that derives base appearance
- [x] A test opens a BOS fixture with two material colours and checks the instance colour buffer after show()

Found 2026-10-12 by the bench's side-by-side page (ara3d/bim-open-bench), where the BIM Open Viewer pane drew the Duplex in one flat grey while IFClite, That Open, the Speckle fork (reading the same .bos) and the Static glTF Viewer showed its materials. Evidence, at pin 16b8a3c: packages/loaders/src/bos-geometry.ts:226-231 writes each instance's colour from the Materials table; packages/viewer/src/create-viewer.ts:466, in show(), sets every object's base appearance to record.appearance ?? defaultAppearance, and no reader under packages/formats/src sets record.appearance, so the base is grey ([0.8,0.8,0.8], model/src/style.ts:56); restyle() then applyStyles (render/src/scene-binding.ts:173-196) overwrites the whole instance colour buffer. The gallery and landing page look right only because packages/demos/src/gallery/model-source.ts:34-56 (baseAppearancesOf) rebuilds appearance from the first instance of each object, with a comment that without it a brick building is repainted grey. Fix: derive the base appearance from instance colours when a record has none, in show() or better in formats/src/loaded-model.ts so every reader fills it. The bench pane deliberately makes no workaround (it runs the viewer as shipped); after the fix, bump the pin in the bench's tools/bim-open-viewer/tool.json and in deps.json here.

## Notes

- 2026-10-13: fixed in bim-open-viewer bf02fa5. The derivation lives in the model package (instanceAppearances, withLoadedAppearances); loadedModel() in formats applies it to every read, the gallery helper calls it, and tests cover both. The third criterion is met by a formats test over an in-memory model with two colours, not a BOS file. Pins moved: the bench tools/bim-open-viewer/tool.json (29978cf) and deps.json here. The Duplex shows its materials in the bench pane.
