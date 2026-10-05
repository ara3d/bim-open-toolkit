---
id: TKT-44
title: A browser test drives the long-value editor's Cancel and click-outside through the real island mount
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/test/**, gates/**]
workflow: [process]
---

## Acceptance criteria

- [ ] A Playwright or headless-browser test mounts the editor through the gratify runtime, opens an Expression row, types, clicks outside, and asserts one setParam and one undo step; a second case presses Cancel and asserts no setParam

Debt from TKT-22: jsdom cannot fire the island focusout the way a browser does, so those two paths are covered only by unit tests on longValueEditor.ts. The supervisor verified them by hand on 2026-09-26.
