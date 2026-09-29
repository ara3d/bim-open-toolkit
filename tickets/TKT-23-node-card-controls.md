---
id: TKT-23
title: Node cards carry real controls: slider, dropdown, toggle, swatch, column picker
status: open
depends_on: [TKT-22]
owner:
fence: [bimopenflow/web/packages/graph/**, bimopenflow/web/packages/app/**, docs/DEMOS.md, samples/**]
---

## Acceptance criteria

- [ ] Every ParamKind renders as a visual control on the node card, not only a text field: a bounded number as a slider with the typed value beside it, an enum as a dropdown, a bool as the existing toggle, a colour as a swatch that opens a picker, a column as a picker fed by the upstream schema
- [ ] Each control commits through setParam as one undo step and never rejects a value (principle 6: warn, never block)
- [ ] A committed showcase graph exercises every control kind, and its capture is linked from docs/DEMOS.md
- [ ] The app tests cover one control per kind, and gates/web-smoke.mjs passes

Owner's finding of 2026-09-26: the nodes were too bland and lacked interesting controls, and the sample graphs demonstrated too few of them. TKT-22 moves every parameter onto the node; this ticket makes those parameters controls worth touching. Serves W2 and W3. Start from bimopenflow/web/packages/app/src/canvasControls.ts (BoolSlot is the model) and numericParam.ts.

## Notes from TKT-22 (2026-09-26)

The registry is ready: a control is a `SlotControl` member, a `CONTROL_HEIGHT` row, a factory in `SLOT_FACTORIES`, and, for descriptor-driven controls, a `DESCRIPTOR_CONTROL` row. Two debts land here: coalesce the slider and range widgets' per-move setParam writes into one undo step (graphWidgets.ts; the typed slider is the first control that needs it), and let factory modules register a prune hook instead of pruneSlots naming every store.

## Notes from TKT-94 (2026-09-28)
The controls live in `bimopenflow/web/packages/graph` now: `canvasControls.ts`, `canvasSlots.ts`, `slotRegistry.ts`, `graphWidgets.ts`. Every control reaches its row's `CanvasInstance` through `SlotContext.instance` (dispatch, islands, dropdown flags) and must honour `instance.readOnly`. Planned debt to pay here: `gratifyWidgets.ts` and `gratifyRangeMath.ts` are copies of gratify's example slider and range (the package must not import gratify's examples); the typed slider this ticket builds replaces them, and the copies are deleted.
