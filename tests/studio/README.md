# tests/studio

NUnit projects for `src/studio`. Both replace the language model with a scripted
`HttpMessageHandler` and drive the real MCP tool server, so no key and no network are needed.
The Studio scripts in `Ara3D.Studio.BimTools` run only inside Ara 3D Studio and have no tests here.

| Project | Covers |
|---|---|
| `BimOpenFlow.Studio.Tests` | The agent loop in `BimOpenFlow.Ask` against the flow tool server, the graph ids, the key resolution, and the host's graph checks |
| `BimOpenMcp.Ifc.Ask.Tests` | The IFC question runner: the command line, the fresh conversation per question, the hidden tools, and the transcript and results files. One test runs a whole scripted run over `data/duplex.ifc` and is ignored when that fixture has not been fetched |
