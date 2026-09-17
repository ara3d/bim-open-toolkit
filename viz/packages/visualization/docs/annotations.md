# Notes, overlays and capture

`AnnotationDocument` is a standalone schema-v1 document with text, IDs, world positions and optional object references. It does not alter `SceneDocument`. Validation rejects unknown fields, runtime values, malformed coordinates, duplicate IDs and unsupported versions. Add/update/remove return detached data; optional reference diagnostics retain world anchors if the object is missing. Anchors remain in world coordinates when referenced objects move.

`AnnotationOverlay(container, camera)` owns an SVG root containing point markers, leader lines and plain text labels. Set annotations after data changes and call `update(width, height)` after camera/viewport changes. It hides out-of-frustum anchors, but labels are screen overlays with no geometry depth occlusion or collision avoidance. The container must be positioned and match the canvas bounds. `dispose()` removes only owned content. No browser globals are accessed on import and no polling runs inside the adapter.

The notes mini viewer schedules projection updates on pointer movement, wheel input and ResizeObserver notifications. Click placement ignores drags and cancellation; edit/remove controls and separate JSON save/restore operate on the public data API. Cleanup removes listeners, cancels scheduled work and disposes the overlay. The harness owns the positioned canvas container and route teardown.

`captureCanvas(canvas, renderFrame)` synchronously renders immediately before requesting PNG encoding so it works with nonpreserved WebGL drawing buffers. It returns a Blob or a `CaptureError` (`invalid-size`, `render-failed`, `encode-failed`). The host owns render scheduling and canvas origin cleanliness. PNG includes the drawing buffer only, excluding DOM labels and controls. The capture mini viewer displays a thumbnail and download button and revokes temporary URLs when replaced or disposed.

## Checkpoint

- Contracts: V1/G1 unchanged; both required skills reread; latest file fence acknowledged.
- State: verified. Focused Vitest (`test/annotations.test.ts test/capture.test.ts --maxWorkers=1 --cache=false`) passed 13 tests. Isolated strict TypeScript check of all new sources/demos (`--noEmit`, ES2022/bundler, strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes) passed.
- Owned: `src/annotations.ts`, `src/overlay-renderer.ts`, `src/capture.ts`, their assigned tests, two feature demos and this document.
- Running processes: none.
- Outstanding: focused verification, coordinated commit, supervisor browser verification.
- Deferred: note attachment transforms, occlusion/collision, rich text, measurement geometry and composited DOM screenshots.
