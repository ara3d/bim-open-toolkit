# Ambient occlusion demo

`viewer/packages/demos/ambient-occlusion.html`, served by `vite.ao.config.mjs` on port 5177.

```
cd viewer
npx vite --config packages/demos/vite.ao.config.mjs
```

## What it shows

A screen-space contact shadow over a synthetic model: corners, the foot of every wall and the
gap under each door go darker, which is what makes a flat-lit model readable. The picture is
drawn by three's GTAO pass behind the render package's `AmbientOcclusionTarget` seam, so the
settings a person changes are the render package's own `AmbientOcclusionSettings`, checked by
`checkAmbientOcclusion` before a renderer sees them.

Three fixtures, all synthetic and deterministic: one building (150 objects), a city of six
buildings, and a stress scene cut down to 2,000 instances so a software renderer can draw it.
They span three scales, which is what exercises the automatic radius: at zero the pass takes a
twentieth of the model's widest extent, so the same setting is right for all three. The adapter
sets GTAO's sample thickness to four times the radius, the ratio three's own example uses; at the
default one metre a two-metre radius threw away most of every wall and read as a line at its foot.

Controls: on or off; shaded picture or the occlusion term on its own (white where open, dark where
enclosed); radius; intensity; samples per pixel; and the occlusion buffer's size relative to the
drawing buffer. Hold the **Compare** button or the `a` key to see the plain picture. The status line
reports the fixture's counts, the pass in force, the last frame interval and the renderer string.

## What is honest about it

- Every fixture is generated from a seed. Nothing here is a measurement of a real building.
- The occlusion-only view is the term the pass actually blends, after its own filter, not a
  separate visualisation.
- Frame intervals are reported, not asserted. A software renderer draws a frame in hundreds of
  milliseconds; a hardware one in a few.
- "Off" draws straight to the canvas with no post-processing, so a comparison is against the
  plain viewer picture. The composer's buffer is multisampled so that "on" is antialiased too.

## Limitations

- The pass renders normals and depth with an override material. viewer-core's instance alpha
  (hidden and ghosted rows) is a fragment discard in its patched material, which the override does
  not carry, so a hidden instance still occludes. None of the three fixtures hides anything; a
  feature over a model with hidden rows needs the discard in the override material.
- Transparent instances (the stress scene's glass) occlude as if solid, for the same reason.
- Orthographic views are not drawn; the page has one perspective camera.
- The page owns its `WebGLRenderer` and drives viewer-core's `SceneObject` itself, because
  `Viewer` keeps its renderer private and leaves no place for a pass between scene and screen.
  That is a request to the alpha core in the checkpoint, not something this page can fix.

## Verification

```
cd viewer
npx tsc --noEmit -p packages/demos/tsconfig.json
npx eslint packages/demos/src/ambient-occlusion packages/demos/test/ambient-occlusion
npx vitest run --root packages/demos test/ambient-occlusion
```

`steps.test.ts` runs in Node: every fixture binds, the building has the counts the slice page also
reports, the panel round-trips the render package's default and refuses what it refuses, luminance
statistics come out as expected. `page.test.ts` opens the page in a headless Edge or Chrome with
software WebGL and measures the drawing buffer: the shaded picture with the pass is darker than
without it, and the occlusion term has both open and enclosed pixels. It skips with a printed
reason when no browser launches. Screenshots go to `viewer/artifacts/ambient-occlusion/`.
