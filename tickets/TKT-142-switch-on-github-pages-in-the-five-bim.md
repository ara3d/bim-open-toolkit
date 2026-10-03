---
id: TKT-142
title: Switch on GitHub Pages in the five BIM Open repositories and authenticate gh
status: open
depends_on: []
owner:
fence: []
kind: action
---

Two things only the owner can do, after the repository split of 2026-10-03.

1. Switch on GitHub Pages (Settings, Pages, Source: GitHub Actions) in each of: ara3d/bim-open-toolkit, ara3d/bim-open-viewer, ara3d/bim-open-notebook, ara3d/bim-open-data, ara3d/bim-open-flow.
2. Authenticate the GitHub command line on this machine (run gh auth login) so agents can check Pages deployments and CI runs.

Done when: each of the five repositories serves a Pages site from its workflow, and gh auth status succeeds on this machine.
