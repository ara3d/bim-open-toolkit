---
id: TKT-253
title: Pressing New stores an empty untitled flow for good, and they pile up in the flow picker
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/bimopenflow/web/packages/app/src/**, deps/bim-open-flow/bimopenflow/web/packages/app/test/**]
workflow: [W2]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] Pressing New opens a blank flow that is not stored until the user saves it or makes a first edit, and Save on a new flow asks for a name
- [ ] The flow picker separates the user's own flows from the seeded samples, so untitled-1 to untitled-5 no longer sit between bfast-buffers and voxel-density
- [ ] An unedited untitled flow left over from before is removed or hidden on the next host start

Seen 2026-10-11 on the bim profile at http://localhost:5300: the picker lists untitled-1 to untitled-5 among the samples. Each came from a press of New in an earlier session and holds nothing. The host store keeps every one of them for good.
