---
id: TKT-299
title: Design, in Plato, a STEP B-rep to mesh library: types, laws, and validation before any algorithm
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/**]
workflow: [W3, W4]
confidence: high
created: 2026-10-17
---

## Acceptance criteria

- [ ] sandbox/step-brep-mesh holds a README per layer and Plato files declaring every type, concept, function signature, and law the library needs to read a STEP B-rep and produce triangle or quad meshes; algorithm bodies may be deferred
- [ ] every approximate statement names its tolerance; every structural invariant is a Law_ Boolean function; constructs Plato lacks are written in the specification DSL described in SPEC-DSL.md
- [ ] a fresh reviewer finds no type referenced but undeclared, and no law that contradicts another layer
- [ ] TASKS.md orders the implementation into chunks whose acceptance is the laws they must make pass

Owner request 2026-10-17: a first-principles design, written as Plato pseudo-code plus README documents, for a library comparable to a B-rep kernel's read-and-tessellate half. Editing is out of scope. The design covers the STEP Part 21 file model, the ISO 10303-42 geometry and topology subset used by AP203/AP214/AP242 B-reps, edge discretization, face meshing with seams and poles, mesh validation, and the pipeline that composes them. Serves workflow 3 (a picture of the model from exact geometry) and workflow 4 (a future STEP node pack); this pass moves no Done line, it prepares the tasks that will.
