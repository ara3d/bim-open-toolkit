---
id: TKT-1
title: Who comes first when they conflict: the analyst with an agent in the studio, or the developer integrating the libraries?
status: open
depends_on: []
owner:
fence: []
kind: question
---

docs/REPOSITORY-HANDOFF.md ('What I think you are trying to achieve') names the tension: packaging excellent independent libraries (engine, viewer, converters, typed query libraries) and delivering one easy application are separate jobs, and the repository has not chosen. PROJECT.md is written with the analyst-plus-agent first and the developer last, because the last month's commits (DuckDB studio, Ask box, MCP servers, skills, NRC walkthrough) all serve the analyst, and the owner's aims for the next stretch are Snowdon analysis, Claude integration, and the BimOpenFlow experience.

Options: 1. Analyst with an agent first; libraries are shaped by what the studio needs. 2. Libraries first; the studio is a showcase. 3. Both equal, decided per feature.

Default: option 1. Decides which of two competing features wins a chunk, and whether a UX gap outranks a missing API.
