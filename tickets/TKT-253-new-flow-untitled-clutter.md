---
id: TKT-253
title: Pressing New stores an empty untitled flow for good, and they pile up in the flow picker
status: done
depends_on: []
owner: builder-TKT-253
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [deps/bim-open-flow/bimopenflow/web/packages/app/src/**, deps/bim-open-flow/bimopenflow/web/packages/app/test/**]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-12
kind: defect
---

## Acceptance criteria

- [x] Pressing New opens a blank flow that is not stored until the user saves it or makes a first edit, and Save on a new flow asks for a name
- [x] The flow picker separates the user's own flows from the seeded samples, so untitled-1 to untitled-5 no longer sit between bfast-buffers and voxel-density
- [x] An unedited untitled flow left over from before is removed or hidden on the next host start

Seen 2026-10-11 on the bim profile at http://localhost:5300: the picker lists untitled-1 to untitled-5 among the samples. Each came from a press of New in an earlier session and holds nothing. The host store keeps every one of them for good.

## Resolution

bim-open-flow 1a78f92. New opens a blank flow held in the editor under the next free untitled id; its first edit stores it (app.ts `storeDraft`), and Save on an untitled flow asks for a name in an inline form (app/src/namePrompt.ts), stores the flow under it, and writes an empty document over the untitled id. The picker groups "Your flows" before "Samples" (the page's template ids; app/src/flowList.ts). Criterion 3 is met by hiding: every load reads one document per distinct graph hash among the untitled-N flows and leaves the empty ones out of the picker, and the next New reuses their ids. Removing them needs a host change: a `DELETE /api/analyses/{id}` route in DocumentEndpoints.cs (AnalysisStore has no delete), or a sweep at host start that drops empty untitled-N analyses. Known limit: storing the blank flow reopens it from the host, so the undo history starts after the first edit. Tests: app/test/newFlow.test.ts, flowList.test.ts, ids.test.ts, studioChrome.test.ts.
