# BIM Open Flow: local 3D demo

Requires Node.js/npm, .NET 8 SDK, and the private Snowdon BOS model. Run from the repository root.

One-time setup:

```powershell
git submodule update --init --recursive
npm install --prefix viewer
npm run build --prefix viewer
npm install --prefix bimopenflow/web
```

Start the two services in two terminals:

```powershell
npm run host --prefix bimopenflow/web
```

```powershell
npm run web --prefix bimopenflow/web
```

The first builds and runs the BIM host on port 5214; the second runs the editor on port 5300. Each logs to its own terminal; Ctrl+C stops it. Both ports are fixed: the editor proxies `/api` to `127.0.0.1:5214`.

Open [3d.html](http://127.0.0.1:5300/3d.html). Select graph nodes to preview category colors, ghosting, sections and explosion on the right. Edit node controls to update the view; graph edits autosave. Drag the divider to resize; use **Fit graph** or viewer **Fit** to reframe.

The host reads `%USERPROFILE%\Documents\BIM Open Schema\Snowdon Towers Sample Architectural.bos`; set `BIMOPENFLOW_SNOWDON` to a full path to use another copy. Snowdon is seeded only into an empty store; delete `artifacts/bim-flow/store` to reseed.

If port 5214 is refused, an earlier host is still running — stop it rather than picking another port. A second host cannot run alongside the first: `dotnet run` rebuilds into `src/BimOpenFlow.Host/bin`, which the running host holds open, so the build fails. Note that `dotnet run` gives the host the project directory as its working directory, which is why the `--store` and `--cache` paths in `bimopenflow/web/package.json` are written relative to `src/BimOpenFlow.Host`.

Optional prepared BFAST setup: [3D guide](docs/bim-flow-3d.md); timing breakdown: [startup profile](docs/bim-flow-startup.md).
