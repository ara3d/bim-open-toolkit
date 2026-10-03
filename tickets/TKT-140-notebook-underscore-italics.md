---
id: TKT-140
title: Notebook replies italicise text between underscores inside words, mangling column names
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/bim-open-notebook/src/page/markdown.ts, bimopenflow/web/packages/bim-open-notebook/test/markdown.test.ts]
kind: defect
---

## Acceptance criteria

- [ ] OperationalCarbon_kgCO2e_per_year renders as written, with its underscores, in a reply
- [ ] _italic_ between word boundaries still renders as italics
- [ ] test/markdown.test.ts has a case for a_b_c

Seen 2026-10-03 in samples/notebooks/nrc-eight-questions turn 1, which shows OperationalCarbon followed by italic kgCO2eperyear. Cause: `ITALIC_UNDERSCORE_RE = /^_([^_\n]+)_/` in `src/page/markdown.ts` (line 163) is applied at any position (line 205), including inside a word. Allow underscore emphasis only when no letter or digit precedes the opening underscore or follows the closing one, as CommonMark does. Introduced in 5e3638b (TKT-80).
