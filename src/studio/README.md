# src/studio

Ara 3D Studio integration. Both projects exist because of Studio and depend
on its plug-in API (`Ara3D.Studio.API` from the SDK submodule).

| Project | Role |
|---|---|
| `Ara3D.Studio.BimTools` | Studio scripts over BOS data: filters, room and level tools, door clearance, diagrams, the room navigator overlay |
| `BimOpenFlow.Studio` | Hosts the BimOpenFlow host and MCP server inside Studio, with the Ask agent loop |

Tests are under `tests/studio`.
