# BIM Open Flow: local 3D demo

Requires Node.js/npm, .NET 8 SDK, and the private Snowdon BOS model. Run from the repository root (PowerShell).

One-time setup:

```powershell
git submodule update --init --recursive
npm install --prefix viewer
npm run build --prefix viewer
npm install --prefix bimopenflow/web
```

Start the backend in one terminal (replace the model path):

```powershell
$env:BIMOPENFLOW_SNOWDON = "C:/models/Snowdon Towers Sample Architectural.bos"
dotnet run --project src/BimOpenFlow.Host -- --profile bim --port 5214 --store artifacts/bim-flow/store --cache artifacts/bim-flow/cache
```

Start the frontend in another terminal:

```powershell
npm run dev --prefix bimopenflow/web -w @bimopenflow/app
```

Open [3d.html](http://127.0.0.1:5300/3d.html). Select graph nodes to preview category colors, ghosting, sections and explosion on the right. Edit node controls to update the view; graph edits autosave. Drag the divider to resize; use **Fit graph** or viewer **Fit** to reframe.

Snowdon is seeded only into an empty store; use a new store directory if absent. Do not start duplicate servers on occupied ports. Optional prepared BFAST setup: [3D guide](docs/bim-flow-3d.md); timing breakdown: [startup profile](docs/bim-flow-startup.md).
