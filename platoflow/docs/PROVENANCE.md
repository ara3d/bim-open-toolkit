# Provenance

Copied 2026-08-30 as part of the initial population of bim-open-toolkit (PLAN.md tier 5).

- **PoC code** (`platoflow/` — web/, host/, demo/, tools/, data/, root docs, PNGs):
  from repo `studio/ara3d-sdk`, path `wip/platoflow-poc`,
  commit `82df7322569ecc27696f5699b42e4ab9a148ad66`.
  Excluded on copy: `node_modules`, `dist`, `bin`, `obj`, `*.log`, and the large
  model/cache files in `data/` (`*.ifc`, `*.bos`, `*.duckdb`, `data/out/`).
- **Design docs** (this directory): from repo `studio`, path `docs/`, same checkout date:
  `platoflow-ifc-design.md`, `platoflow-v1-nodes.md`, `platoflow-graph-semantics.md`,
  `platoflow-agent-concepts.md`, `platoflow-compliance-design.md`,
  `platoflow-design-principles.md`.

The PoC is **reference material for the PlatoFlow rewrite, not a foundation to extend**.
The rewrite happens in this repo against `platoflow-v1-nodes.md`; the PoC copy exists to
be stripped for parts and consulted for the findings recorded in `../NOTES.md`.

Change from origin: the `gratify` canvas library is resolved from this repo's git
submodule at `submodules/gratify` (Vite alias in `web/vite.config.ts`), instead of the
`studio` superproject's submodule.
