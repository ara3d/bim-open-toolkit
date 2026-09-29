---
id: TKT-111
title: The notebook page lays out at the phone's width, with no horizontal scroll at narrow windows
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/bim-open-notebook/notebook.html, bimopenflow/web/packages/bim-open-notebook/src/page/**]
---

## Acceptance criteria

- [ ] notebook.html has a viewport meta tag, so a phone lays the page out at its own width instead of about 949 px
- [ ] At an 820 px and a 375 px window the column and every embed fit the window; the page never scrolls sideways

Found 2026-09-28 by the TKT-108 browser check: in an 820 px window the notebook column measured 949 px wide and the page scrolled sideways, and phone-width emulation laid out at about 949 px because the page has no viewport meta. TKT-109 (column widened to 1140 px) could not confirm its 375 px check for the same reason.
