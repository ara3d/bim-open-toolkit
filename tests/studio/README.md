# tests/studio

NUnit projects for `src/studio`. Both replace the language model with a scripted
`HttpMessageHandler` and drive the real MCP tool server, so no key and no network are needed.
The Studio scripts in `Ara3D.Studio.BimTools` run only inside Ara 3D Studio and have no tests here.

| Project | Covers |
|---|---|
| `BimOpenFlow.Studio.Tests` | The agent loop in `BimOpenFlow.Ask` against the flow tool server, the graph ids, the key resolution, and the host's graph checks |
| `BimOpenMcp.Ifc.Ask.Tests` | The IFC question runner: the command line, the fresh conversation per question, the hidden tools, and the transcript and results files. One test runs a whole scripted run over `data/duplex.ifc` and is ignored when that fixture has not been fetched |

`ClaudeCliBackendTests` in `BimOpenFlow.Studio.Tests` covers the Claude Code command-line backend
the same way: a scripted `fake-claude/claude.cmd` (see `tests/studio/fake-claude/README.md`) plays
back stream-json lines and calls the real MCP tool server, so no `claude` login and no network call
to Anthropic are needed. What these tests cannot show: a real login, a real model's tool choices,
or the CLI's behaviour against a network failure or a truncated MCP result.
