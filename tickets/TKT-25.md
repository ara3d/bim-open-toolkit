---
id: TKT-25
title: The Ask panel keeps its size while a reply streams
status: claimed
depends_on: []
owner: small-job-builder
fence: [bimopenflow/web/packages/app/src/duckdbDemo.ts, bimopenflow/web/packages/app/src/duckdbDemo.css, bimopenflow/web/packages/app/test/**]
---

## Acceptance criteria

- [ ] The editor's height does not change when Ask events arrive: the log has a fixed height (or a user-dragged one) and scrolls internally
- [ ] The transcript stays readable: the newest line is visible, and earlier turns can be scrolled back to
- [ ] A test renders twenty Ask events and asserts the editor's box does not move; gates/web-smoke.mjs passes

Owner's finding of 2026-09-26: the 'ask claude' panels resized when feedback came back from the agent. Cause: in bimopenflow/web/packages/app/src/duckdbDemo.css the log grows to max-height 180px above a flex editor, so every event moves the canvas. Serves W2.
