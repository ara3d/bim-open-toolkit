# tools

Wrappers that point the platonic-ts toolset (sibling checkout `../platonic-ts`) at this repository's `viewer/` workspace, because its entry points target their own repository.

- `platonic-mcp.ts` starts the platonic-ts MCP server over `viewer/`. Registered in `.mcp.json`; run by hand with `node ../platonic-ts/node_modules/tsx/dist/cli.mjs tools/platonic-mcp.ts`.

See `docs/plans/visualization/V2-PLAN.md`, section Toolset.
