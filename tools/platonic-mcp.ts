// Starts the platonic-ts MCP server (sibling checkout ../platonic-ts) over the viewer workspace.
// Registered in .mcp.json; run by hand with: node ../platonic-ts/node_modules/tsx/dist/cli.mjs tools/platonic-mcp.ts
import { resolve } from 'node:path'
import { serve } from '../../platonic-ts/packages/mcp/src/server.ts'

const repoDir = resolve(import.meta.dirname, '..', 'viewer')

serve(
  {
    repoDir,
    baselinePath: resolve(repoDir, 'ratchet.json'),
    write: (line) => process.stdout.write(line),
    log: (message) => process.stderr.write(`${message}\n`),
  },
  process.stdin,
)
