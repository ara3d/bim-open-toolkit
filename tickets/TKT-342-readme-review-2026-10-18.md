---
id: TKT-342
title: README review: correct and update the toolkit README and the stale statements it finds elsewhere
status: open
depends_on: []
owner:
fence: [README.md, docs/OVERVIEW.md, gates/README.md, samples/notebooks/README.md, site/index.html]
workflow: [W1]
confidence: high
created: 2026-10-18
---

## Acceptance criteria

- [x] README.md's commands, counts, links and demos match the repository on 2026-10-18
- [x] The wrong statements the review found in other files are corrected or ticketed

The owner's request, 2026-10-18, word for word:

> In a background agent review and improve the README correcting any issues, and updating the information.

Done the same day: README.md by a review agent (478b1107: nine claims corrected, the week's features added, Build and run led by the tables profile); the stale statements it found in other files fixed by the session (47a4a6a6: node and pack counts in docs/OVERVIEW.md, the Node range in gates/README.md, the notebook count in samples/notebooks/README.md; dfafe778: the family page's notebook tile links the live NRC walkthrough). Not yet diagnosed: gates/host-smoke.mjs timed out twice while other sessions were building.
