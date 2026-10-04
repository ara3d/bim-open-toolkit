---
id: TKT-111
title: The notebook page lays out at the phone's width, with no horizontal scroll at narrow windows
status: done
depends_on: []
owner: wave-w1
fence: [bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/notebook.html, bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/src/page/**]
---

## Acceptance criteria

- [x] notebook.html has a viewport meta tag, so a phone lays the page out at its own width instead of about 949 px
- [x] At an 820 px and a 375 px window the column and every embed fit the window; the page never scrolls sideways

Found 2026-09-28 by the TKT-108 browser check: in an 820 px window the notebook column measured 949 px wide and the page scrolled sideways, and phone-width emulation laid out at about 949 px because the page has no viewport meta. TKT-109 (column widened to 1140 px) could not confirm its 375 px check for the same reason.

Viewport meta was already present (added earlier in ea347ff). Cause of the overflow: `.nb-column` is an auto-margined item in the flex-column `.nb-shell`, so it sized to its content (949 px). Fixed with `width: 100%` on the column. Measured with headless Chrome over CDP: scrollWidth equals the window width at 1280, 820 and 375 px (less the scrollbar where one shows); wide tables and the graph canvas scroll or clip inside their own containers.
