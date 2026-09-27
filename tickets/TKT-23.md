---
id: TKT-23
title: Node cards carry real controls: slider, dropdown, toggle, swatch, column picker
status: open
depends_on: [TKT-22]
owner:
fence: [bimopenflow/web/packages/app/**, docs/DEMOS.md, samples/**]
---

## Acceptance criteria

- [ ] Every ParamKind renders as a visual control on the node card, not only a text field: a bounded number as a slider with the typed value beside it, an enum as a dropdown, a bool as the existing toggle, a colour as a swatch that opens a picker, a column as a picker fed by the upstream schema
- [ ] Each control commits through setParam as one undo step and never rejects a value (principle 6: warn, never block)
- [ ] A committed showcase graph exercises every control kind, and its capture is linked from docs/DEMOS.md
- [ ] The app tests cover one control per kind, and gates/web-smoke.mjs passes

Owner's finding of 2026-09-26: the nodes were too bland and lacked interesting controls, and the sample graphs demonstrated too few of them. TKT-22 moves every parameter onto the node; this ticket makes those parameters controls worth touching. Serves W2 and W3. Start from bimopenflow/web/packages/app/src/canvasControls.ts (BoolSlot is the model) and numericParam.ts.
