---
id: TKT-140
title: Notebook replies italicise text between underscores inside words, mangling column names
status: done
depends_on: []
owner:
fence: [bimopenflow/web/packages/bim-open-notebook/src/page/markdown.ts, bimopenflow/web/packages/bim-open-notebook/test/markdown.test.ts]
kind: defect
---

## Acceptance criteria

- [x] OperationalCarbon_kgCO2e_per_year renders as written, with its underscores, in a reply
- [x] _italic_ between word boundaries still renders as italics
- [x] test/markdown.test.ts has a case for a_b_c

Seen 2026-10-03 in samples/notebooks/nrc-eight-questions turn 1, which shows OperationalCarbon followed by italic kgCO2eperyear. Cause: `ITALIC_UNDERSCORE_RE = /^_([^_\n]+)_/` in `src/page/markdown.ts` (line 163) is applied at any position (line 205), including inside a word. Allow underscore emphasis only when no letter or digit precedes the opening underscore or follows the closing one, as CommonMark does. Introduced in 5e3638b (TKT-80).

2026-10-03: Fixed. Underscore emphasis now needs no letter or digit before the opening underscore or after the closing one. Checked in a headless Edge on the rebuilt static site: nrc-eight-questions shows OperationalCarbon_kgCO2e_per_year with no italics. Tests added in test/markdown.test.ts.
