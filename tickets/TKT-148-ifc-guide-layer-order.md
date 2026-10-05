---
id: TKT-148
title: Tell the IFC ask to list material layers in order and not to require a width row
status: open
depends_on: []
owner:
fence: [.claude/skills/ifc-ask/**]
workflow: [W2, W5]
kind: idea
---

## Acceptance criteria

- [ ] IFC-Bench questions 387 and 434 rerun correct, or their remaining failure is not about layer order or one-layer types

From the TKT-145 rerun on 2026-10-04. The converted model now holds each layer's position (Ifc:LayerIndex, Ifc:ConstituentIndex) and thickness, but Haiku listed the Ziegeldach 360 roof's layers alphabetically and without the two repeated layers (434), and dropped the one-layer wall type Basiswand:STB 25.0 because its query required '<layer>/Width' rows, which Revit writes only for types with more than one layer (387). A guide line could say: order layers by their index, count a repeated material once per layer, and take a one-layer type's thickness from the element's Width. Both copies of the guide (here and bim-open-data) need it. Unconfirmed that a guide line is enough; a view joining element, type, layer, material, and thickness would be the stronger fix.
