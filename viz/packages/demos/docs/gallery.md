# The demo gallery

A page per demo, an index that lists them, and one model behind all of it.

## Running it

From `viewer/`:

```
npm run gallery
```

Then open `http://localhost:5190/gallery.html`. The index is that address with no query; a demo is
`?demo=<id>`, and a demo on a particular fixture is `?demo=<id>&fixture=<id>`. Every address is a
query string, so the back button works and a link can be pasted into a bug report.

## The model

The demos open Snowdon Towers, a real building: 25,675 objects, 471,462 instances, 6.25 million
triangles. The file is private and about a hundred megabytes, so it is never committed and never
bundled. The dev server hands it out at `/fixtures/snowdon.bfast` from the first directory that has
it — by default `viewer/packages/visualization/artifacts/bfast/`, or the semicolon-separated list in
`V2_FIXTURES_DIRS`, which is the same variable the fixture server reads.

A machine without the file gets a 404 and a demo that says it could not open the model. The second
entry in every fixture picker is a generated building, which is not a fallback: it is there because
its gaps and conflicts are deliberate, and some demos exist to show exactly those.

Framing the real model needs care. It carries geometry five kilometres from the site, so the opening
camera frames the bulk of the model rather than the union of everything in it (`src/gallery/framing.ts`).
Nothing is hidden by this: every object is in the scene, pickable, and counted in the status strip.

## What draws what

A demo names plain features — `environmentFeature`, `layoutsFeature` — because a demo has no
renderer to bind them to. `src/gallery/render-hooks.ts` attaches each feature's render hook once a
model is open, and drops them with the model. Without that step a command changes the state and the
inspector and nothing anybody can see.

## Thumbnails and the browser smoke

From `viewer/`:

```
npm run gallery:smoke
```

This opens every registered demo in a real browser, waits for it to say it is ready and settle,
writes the viewport to `public/thumbnails/<id>.png` — which is what the index cards show — and
writes `docs/gallery-smoke.md`. It exits non-zero if any demo failed, and a demo that failed keeps
no picture, so its card shows the stand-in rather than a photograph of a failure.

It uses the machine's own GPU. Software WebGL was measured at over five minutes without becoming
ready on six million triangles, where the GPU is ready in about twenty seconds;
`GALLERY_SMOKE_SOFTWARE=1` forces the software path, which is only useful for the generated fixtures.

## Adding a demo

Export `demo` from `src/demos/<id>/index.ts`, typed by `src/gallery/contracts.ts`. Discovery globs
for it, so nothing central lists demos and removing a directory leaves nothing behind. Two demos
claiming one id is reported on the index rather than resolved by picking a winner.
