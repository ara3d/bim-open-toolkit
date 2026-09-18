# src/studio

Ara 3D Studio integration, and the language-model agents that drive the MCP servers. The first
two projects exist because of Studio and depend on its plug-in API (`Ara3D.Studio.API` from the
SDK submodule); the last two do not, and run from a command line.

| Project | Role |
|---|---|
| `Ara3D.Studio.BimTools` | Studio scripts over BOS data: filters, room and level tools, door clearance, diagrams, the room navigator overlay |
| `BimOpenFlow.Studio` | Hosts the BimOpenFlow host and MCP server inside Studio, with the Ask box endpoint |
| `BimOpenFlow.Ask` | The agent loop and the OpenAI call, over any in-process MCP server; shared by the Ask box and the question runner |
| `BimOpenMcp.Ifc.Ask` | `bimopenmcp-ifc-ask`: answers a list of questions about one IFC file through the IFC MCP server, unattended, and records every tool call |

Tests are under `tests/studio`.
