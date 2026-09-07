# Gratify review controls

The optional `/gratify` adapter imports only Gratify's public API. `mountReviewControls(canvas, commands)` returns `{dispatch(command), dispose()}`; commands are typed `fit`, `clearSelection` and `toggleGhost` callbacks. The adapter contains no BIM selection, camera or appearance logic. The independent `gratifyDemo` maps these callbacks to the existing viewer features and offers equivalent native HTML buttons.

```ts
import { mountReviewControls } from '@bim-open-toolkit/visualization/gratify';

const controls = mountReviewControls(canvas, {
  fit: () => camera.fit(),
  clearSelection: () => selection.replace([]),
  toggleGhost: () => hostToggleGhost(),
});
controls.dispatch('fit');
// On unmount:
controls.dispose();
```

`createReviewControlsApp(commands)` exposes the actual Gratify model/view/update specification. Pure update changes a small UI document; onCommit invokes one host command. Gratify's part, Stack, Label, animated channels and CanvasPainter render the interface. Frame stepping never invokes model operations; only dispatched commands do. Canvas and HTML inputs dispatch through the same app, including the ghost button's pressed state.

The pinned Gratify 0.2.0 `mount()` path does not detach its anonymous DOM listeners or ResizeObserver when `Runtime.stop()` runs. To provide complete teardown without changing upstream, this adapter uses the public headless Runtime plus public CanvasPainter and owns its canvas input listeners and RAF. Disposal cancels RAF, removes every owned listener, releases pointer capture, calls runtime.stop and restores canvas dimensions/tab state/touch action. It is idempotent and disables subsequent dispatch. No global keyboard handlers, resize observers, debug globals or custom substitute UI renderer are created.

The surface is 288×196 logical pixels, scaled by host CSS; pointer coordinates are mapped back to that surface. It sleeps when animation settles. Up/Down moves Gratify focus, Enter/Space activates it and Tab remains native so focus can leave. Focused controls have a visible border. Screen readers still see a canvas; the demo's native HTML equivalents provide accessible controls. High-DPI adaptation, touch/mobile qualification, full application shell, theme editing and text scaling are not claimed by this small adapter.

Development uses the pinned local Gratify submodule built and linked by the coordinator; no submodule source was modified. Published consumers require a compatible published Gratify release. A local 0.2.0 package build alone does not establish npm release availability or application accessibility certification. The visualization root export remains Gratify-free; dependency/export wiring belongs to the coordinator.

The current optional entrypoint works through the gallery's browser bundler and the Vitest resolver. Direct native Node import of `/gratify` fails with `ERR_UNSUPPORTED_DIR_IMPORT`: pinned Gratify 0.2.0 emits an extensionless `dist/core` directory import. Native Node consumers need an upstream packaging correction or a compatible release. This limitation does not affect the visualization root data API, which was independently imported in Node without DOM access. Headless Runtime tests use Vitest resolution and do not establish native Node package compatibility.

## Track checkpoint

- State: verified against G1.1/V1, four owned files: `src/gratify.ts`, `test/gratify.test.ts`, `examples/features/gratify.ts`, this document.
- Direct Vitest `run test/gratify.test.ts --maxWorkers=1 --cache=false`: 3/3 passed using the real public Gratify Runtime for MVU/headless rendering/keyboard routing. A separate fake-canvas lifecycle test verifies owned listener removal, RAF cancellation, canvas restoration and ignored post-disposal dispatch; it does not claim raster rendering coverage.
- Strict no-emit TypeScript check for adapter and demo passed, including exact optional fields and unchecked indexes.
- Implementation landed in `77624b8`. No builds, installs, submodule changes or processes left running. Coordinator owns final browser canvas qualification. The later documentation-only qualification records the native Node import limitation above; it adds no runtime changes.
