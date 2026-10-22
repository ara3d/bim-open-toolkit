---
id: TKT-471
title: STEP mesher idea: sew twin edges across bodies (THEO-P173's one-face closed shells), as an opt-in policy
status: open
depends_on: []
owner:
fence: []
workflow: [W3]
related: [TKT-467]
created: 2026-10-22
kind: idea
---

An option, not agreed work (v1 supervisor, 2026-10-22). TKT-467's probe found that THEO-P173 writes each face of a solid as a body of its own, its one-face shell declared closed: of its 1,848 once-cited edges, 1,828 have a twin within 10 times the length tolerance only in another body. The MAYA REVC files have 136 such cross-body twins. Sewing across bodies, merging coincident vertices and twin edges between different bodies and joining their shells, would close those shells, but it assumes that touching solids are one, which is wrong for an assembly of parts that touch and invents structure the file does not state (the brief's honest-absence principle). TKT-467 (track v1-jody, J6) sews within a shell only and reports every declared-closed shell left open. Decide later whether a policy flag for cross-body sewing is worth having, and on what evidence (for example, every face of the bodies being single-face closed shells).
