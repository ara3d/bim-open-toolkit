# Proposal: the studio look

> Written 2026-09-29 by Claude Fable 5.1 with Christopher Diggins, from a
> review of a screenshot of the editor at `/?analysis=clash-candidates` and
> a prototype built the same day. Status: prototype at `/studio.html`, kept
> beside the classic look at `/`; which one to continue, or whether to start
> a third, is an open decision.

## What the review found

The classic page works but reads as a developer tool. The header is a slug
picker and two unlabeled selects; the canvas is mostly empty grey with the
graph huddled in a corner and a one-line gesture hint as the only
onboarding; every node card looks alike; the right column has a void above
the panes; the 3D pane offers "Retry model" before anything failed; the
legend scrolls off the bottom; four text sizes and three greys carry no
hierarchy; nothing on the page says "click me first".

## What the prototype does

One controller, two looks. `bimopenflow/web/packages/app/src/chrome.ts`
names what the controller needs from a look and what a look may ask for;
`classicChrome.ts` is the old page moved behind it unchanged, and
`studio/studioChrome.ts` is the new one. The shared content (canvas, step
list, problems strip, start page, Ask panel, pane area) is the same code in
both, restyled by `studio/studio.css` under `.bof-studio`.

The studio look, by area:

- Command bar: brand mark, the flow's title as the heading (sample titles
  from the catalog, else the id read as words) with the id and step count
  under it, New, Save with an unsaved dot, one primary Run, a View menu for
  the canvas theme and node style, and a connection dot.
- Left: the shared Steps / Nodes sidebar as a segmented control; steps as
  rows with a numbered disc, a status pill, and the row count.
- Canvas: a floating toolbar (Fit, Tidy, Add node), a card when the flow
  has no steps ("Start from a template", "Add a node", "Ask Claude"), a "?"
  popover listing the gestures, and the problems strip as a card. Tidy is
  a new controller action (auto layout as one undo step, then fit) that the
  classic look could also expose.
- Node cards: the `studio` canvas theme adds a stripe per pack on the left
  edge (sources teal, table work blue, geometry purple, views orange,
  writers red, checks green). The light and dark themes draw none.
- Right: the Ask box first, with rotating example prompts as its
  placeholder and an empty transcript taking no room; the pane header as
  title, detail, and lineage; underline tabs; the 3D toolbar, status, legend,
  and picked-element properties floating over the viewport; Retry only
  after a failed load.

## What it does not do yet

- Selection linked across step list, canvas, and 3D (PROJECT.md workflow 4).
- A "colour by" control on the 3D legend, and one colour domain shared with
  the chart pane.
- A rename for flows; the title is derived, not editable.
- Dark mode for the chrome (the canvas has one).
- The DuckDB and 3D demo pages still use the classic look.

## How to decide

Open `/` and `/studio.html` on the same flow (`?analysis=clash-candidates`
over the Duplex sample, or a Snowdon flow) and compare the first minute:
which page says what it is for, where to click first, and what a step is.
Because the controller is shared, the choice costs nothing in logic: keep
one chrome factory and delete the other, or write a third against
`chrome.ts`. A third look should start from `studioChrome.ts` (about 250
lines) rather than from `app.ts`.
