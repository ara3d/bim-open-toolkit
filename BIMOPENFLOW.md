# BIM Open Flow: local 3D demo

Requires Node.js/npm, .NET 8 SDK, and the private Snowdon BOS model. Run from the repository root (PowerShell).

One-time setup:

```powershell
git submodule update --init --recursive
npm install --prefix viewer
npm run build --prefix viewer
npm install --prefix bimopenflow/web
```

Start both services with one command (replace `-ModelPath` if the model is elsewhere):

```powershell
./scripts/start-bimopenflow.ps1
```

The launcher starts the BIM host on port 5214 and the editor on port 5300, waits until both respond, and prints their process IDs and per-run logs in `artifacts/bim-flow/launch`. It defaults to `%USERPROFILE%/Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos`; pass `-ModelPath 'C:/models/Snowdon Towers Sample Architectural.bos'` to use another copy. Stop the printed process IDs when finished. It refuses occupied ports; use `-HostPort` and `-WebPort` to choose alternatives.

Open [3d.html](http://127.0.0.1:5300/3d.html). Select graph nodes to preview category colors, ghosting, sections and explosion on the right. Edit node controls to update the view; graph edits autosave. Drag the divider to resize; use **Fit graph** or viewer **Fit** to reframe.

Snowdon is seeded only into an empty store; use a new store directory if absent. Do not start duplicate servers on occupied ports. Optional prepared BFAST setup: [3D guide](docs/bim-flow-3d.md); timing breakdown: [startup profile](docs/bim-flow-startup.md).
