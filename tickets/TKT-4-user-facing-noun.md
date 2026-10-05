---
id: TKT-4
title: What is the user-facing noun: analysis, workflow, or graph?
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
kind: question
---

docs/platoflow/platoflow-graph-semantics.md section 4 (2026-08-30) retired 'workflow' in favour of 'analysis'; the host's API and store use analysis (listAnalyses, /api/analyses); newer documents and code (docs/bim-flow-duckdb.md 'Workflows', samples/duckdb-analyses/workflows.json, the UX proposal) say workflow; the editor and the MCP tools say graph. A person sees all three. The brief uses 'graph' for the artefact and 'analysis' for the saved, named thing, and avoids 'workflow' because PROJECT.md uses that word for the user's own workflow.

Default: analysis for the saved thing, graph for its structure, and 'workflow' only in the brief's sense. Decides labels in the editor, the studio picker, the MCP tool descriptions, and the sample folder names.
