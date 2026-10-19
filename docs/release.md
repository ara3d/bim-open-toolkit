# The Windows release

One zip for a Windows 10 or 11 computer. It holds the whole system (the studio host with the BIM node packs, the two MCP servers that let Claude read models and build graphs, the IFC converter, the Ask runner, the built web pages, the NRC notebooks, and the NRC and public sample models) and a program, `bimopen.exe`, that connects it to the Claude Code already on the computer and checks that everything works. Nothing else needs installing: no .NET SDK, no Node, no npm, no git, no `node deps.mjs`, and no administrator rights. The language model is whatever Claude Code on that computer is signed in to; the release holds no API key and calls no hosted service of its own.

Ticket: TKT-322. Workflow served: W1 in `PROJECT.md`, "Look, then install one thing": the documented install takes one command, and Claude answers a question about a public sample model.

## The one command

1. Install Claude Code, once, if it is not installed. In PowerShell: `irm https://claude.ai/install.ps1 | iex` (other ways are on https://code.claude.com/docs/en/setup). Sign in by running `claude` and following the browser page.
2. Download `BimOpenToolkit-<version>-win-x64.zip` from the repository's Releases page, and unzip it to a folder you can write to (for example `C:\BimOpen`). Do not run it from inside the zip.
3. Double-click `bimopen.exe`, or run `bimopen setup` in a terminal opened in that folder.

The setup finishes in about a minute. Afterwards:

| Command | Does |
|---|---|
| `bimopen start` | Starts the host with the `bim` profile on a free port, puts the graphs of the sample notebooks on it (a fresh host does not hold them, and the notebook page can read their results only from a host that does), and opens the NRC notebook page (`nrc.html`) in the default browser. The host keeps running after the window closes. `BIMOPEN_NO_BROWSER=1` prints the address and opens nothing. |
| `bimopen stop` | Stops the host that `start` left running. |
| `bimopen doctor` | Runs every check again, changes nothing, and says what is wrong and how to fix it. |
| `bimopen questions` | Puts the nine NRC questions to the Duplex model through your Claude Code (the Ask runner), and writes `artifacts\nrc\transcript.md` and `results.json`. It spends tokens from your Claude account, so it never runs by itself. |
| `claude` | In any terminal: ask about a model ("how many doors are in `<folder>\samples\nrc\duplex-enriched.ifc`?"). The two skills tell Claude which tools to use. |

If Windows SmartScreen says the program is from an unknown publisher, the release is not code-signed yet (see "Wrappers" below). Choose "More info", then "Run anyway", or ask your IT group to allow the folder.

## What is in the zip

```
BimOpenToolkit-<version>-win-x64/
  bimopen.exe             the wizard and launcher (one self-contained file)
  BimOpenToolkit.sln      an empty marker file, see below
  README.txt, release.json, LICENSE, NOTICE.md, THIRD-PARTY-NOTICES.md, licenses/
  bin/                    the programs, with one .NET runtime between them
    bimopenflow-studio.exe    the host; `bimopenflow-studio mcp` is the dataflow MCP server
    bimopenmcp-ifc.exe        the IFC MCP server
    bimopenmcp-ifc-ask.exe    the Ask runner (the nine questions)
    ifc-to-bos.exe            the IFC converter
    bimopenmcp-flow.exe, bimopenflow-host.exe   the generic servers, which come with the studio (not registered)
  web/                    the built pages the host serves: the studio, the 3D page, nrc.html, notebook.html,
                          __notebooks/ (the sample notebooks), __nrc/graphs.md
  samples/                nrc, notebooks, nrc-analyses, checking-analyses, bim, bim-analyses, view3d-analyses,
                          viz-analyses, showcase-analyses, showcase-tables, tables, public
  skills/                 the bim-flow and ifc-ask skills that setup installs for Claude Code
  docs/                   nodes.md and nodes.catalog.json: every node kind
  state/                  made on first use: the analysis store, the caches, the host log
```

`BimOpenToolkit.sln` is empty on purpose. The host finds the folder that holds `samples\` by walking up from its program to the first solution file (`SampleSeeding.FindRepoRoot`), which is how it works from a source checkout; the marker makes the release folder look like one.

What is not in it: the Snowdon Towers model and its notebook (`s10-snowdon`; the model is CC BY-NC-SA 3.0 and private), the `s11-editing-history` notebook (kept off the NRC set), and the Revit add-ins. The sample buildings are the Duplex Apartment (BSI, CC BY 4.0) and the public sample set in `samples\public` (licences in `samples\nrc\NOTICE.md` and `samples\public\NOTICE.md`); TKT-144 decides which models may ship.

The host is built from the toolkit and its dependencies at the commits `deps.json` pins; `release.json` records the toolkit commit and every pin.

## What setup does

Six steps. Each prints one line per check, `[ ok ]`, `[warn]`, or `[FAIL]`, and a failed check prints what to do under it. Running setup again changes nothing that is already right.

1. **Checking this computer.** Windows 10 or 11 on a 64-bit Intel or AMD processor; the release folder is writable (when it is not, for example under `C:\Program Files`, setup offers to copy the release to `%LOCALAPPDATA%\BimOpenToolkit` and continues from the copy); about 3 GB free on that drive.
2. **Finding Claude.** Looks for `claude.exe`, `claude.cmd`, or `claude.bat` on PATH and in `%USERPROFILE%\.local\bin`, `%APPDATA%\npm`, and `%LOCALAPPDATA%\Programs\claude`. When it is missing, setup prints Anthropic's install command and page and waits: press Enter to check again, or `q` to stop. It never runs the installer itself. Then `claude auth status --json` asks whether Claude Code is signed in (this does not call the model, so it costs no tokens); when it is not, setup says to run `claude auth login`. It also looks for the Claude desktop app's settings file (`%APPDATA%\Claude\claude_desktop_config.json`, or the Microsoft Store copy under `%LOCALAPPDATA%\Packages\Claude_*`).
3. **Choosing the models folder.** Optional: a folder of your own IFC and BOS models. The bundled public samples and the NRC files are always available. The choice is saved in `bimopen.json` next to `bimopen.exe`.
4. **Connecting the toolkit to Claude.** Registers two MCP servers at user scope with `claude mcp add --scope user`, pointing at the programs in `bin\`: `bimopen-ifc` (`bimopenmcp-ifc.exe`) and `bimopenflow-duckdb` (`bimopenflow-studio.exe mcp --profile bim ...`, the dataflow server with the BIM packs, sharing the host's store so a graph Claude builds appears in the editor). The names are the ones the skills use. A registration that already matches is left alone; one for another folder is replaced. Copies the two skills to `~\.claude\skills\` (or `%CLAUDE_CONFIG_DIR%\skills\`). If the desktop app is installed, asks before adding the same two servers to its settings file, after saving a copy of that file as `claude_desktop_config.json.bimopen-backup`.
5. **Testing that it works.** Starts the host from the release folder on a free port with a scratch store, evaluates the sample graph `bim-level-summary` until every node is `Ok`, fetches `nrc.html` and the notebook list, puts the notebooks' graphs on the host, calls `ifc_type_counts` on the sample Duplex through `bimopenmcp-ifc.exe`, and stops the host. The report is also appended to `bimopen-setup.log`.
6. **Starting.** Offers `bimopen start`.

## Why a zip and a program, not an MSI

The owner asked whether the wizard should be an MSI. This release is a zip with `bimopen.exe` in it, because:

- A zip needs no administrator rights and writes nothing to the registry, which TKT-322 keeps out of scope and which many managed machines refuse for a downloaded installer.
- A downloaded `.ps1` script is often blocked by the execution policy or by the mark of the web, so the wizard is an executable. That also makes its checks ordinary C# with unit tests (`tests\release\BimOpen.Launcher.Tests`), with fakes standing in for Claude and the file system.
- The wizard has to run again after Claude is installed or updated and after the folder moves. A program you can run any time (`bimopen doctor`) does that; an installer runs once.
- The folder is the product. It can be wrapped later without changing it.

### Wrappers, when someone asks for one

| Wrapper | Choose it when | What it needs |
|---|---|---|
| Per-user installer (Inno Setup) | People want a Start-menu entry and "Add or remove programs", and no administrator rights. | An Inno Setup script that unpacks the folder to `%LOCALAPPDATA%\Programs\BimOpenToolkit`, adds the shortcuts, and runs `bimopen.exe setup` at the end. About a day, and the folder is unchanged. |
| MSI (WiX) | NRC IT wants managed deployment (Intune, SCCM, group policy), per-machine install, or silent install and uninstall. | A WiX project that lists every file under `bin\`, `web\`, and `samples\` (generated with `heat` or WiX 4 harvesting), a per-machine install folder that is read-only for users (which makes the wizard copy the release on first run, or the MSI install per user), a rule that `bimopen setup` runs per user and not at install time (Claude's settings are per user), and upgrade rules. A few days. |
| Either | Any wrapper that is meant for people outside the owner's group. | **A code-signing certificate.** An unsigned `.exe` or `.msi` from the internet meets SmartScreen and often an antivirus or application-control policy; the signature is what removes that, and a plain OV certificate starts with no reputation, so an EV certificate or Azure Trusted Signing is the dependable choice. Sign `bimopen.exe` and the installer both. The release workflow would add a signing step after the build and before the smoke. |

## Troubleshooting by doctor message

`bimopen doctor` prints the lines below; the text under a `[FAIL]` is the fix.

| Message | Cause and fix |
|---|---|
| `Windows: This is a Arm64 processor.` | The IFC stack is x64 only. Use an Intel or AMD computer. |
| `Install folder: ... is read-only.` | Run setup; it offers to copy the release to `%LOCALAPPDATA%\BimOpenToolkit`. Or unzip to a folder you can write to. |
| `Disk space: Only n MB free ...` | Free about 3 GB on the drive. |
| `Claude Code: the claude command was not found ...` | Install Claude Code (command printed), open a new terminal, run `bimopen setup`. A terminal opened before the install does not see the new PATH. |
| `Claude Code: ... was found but did not run.` | Run `claude --version` in a terminal to see why; reinstall Claude Code. |
| `Sign-in: Claude Code is not signed in.` | Run `claude auth login`. |
| `Sign-in: Claude Code did not say whether it is signed in.` | Run `claude auth status`. An old Claude Code without `auth status` should be updated. |
| `bimopen-ifc: not registered in Claude Code.` / `registered ..., but for another folder` | Run `bimopen setup`. This is also what happens after the folder is moved. |
| `Skills: not installed or out of date` | Run `bimopen setup`. |
| `Claude desktop app: ... lacks the BIM Open servers.` | Only if you use the desktop app: run `bimopen setup` and answer yes. Restart the desktop app afterwards. |
| `Models folder: ... does not exist.` | The folder in `bimopen.json` was moved or deleted. Run `bimopen setup` and choose another, or delete `bimopen.json`. |
| `Release files: missing: ...` | The unzip is incomplete. Unzip again into an empty folder; compare the download size with the release page. |
| `Host: the host did not answer in time.` | Read `state\logs\selfcheck-host.log`. Antivirus or application control that blocks new programs, or a folder that is not writable, are the usual causes. Allow `bin\bimopenflow-studio.exe`. |
| `Sample graph: bim-level-summary: nodes are Error ...` | Read the host log in `state\logs`. Send it to the people who gave you the release. |
| `Notebook page: nrc.html answered ...` | The `web` folder is incomplete; unzip again. |
| `IFC server: bimopenmcp-ifc.exe did not answer` | Run `bin\bimopenmcp-ifc.exe` in a terminal to see its error; antivirus is the usual cause. |

Two more lines appear in the self-check: `Notebook graphs` (the graphs of the sample notebooks are put on the host; a failure means the host refused them, so read its log) and `Release files`.

## Known limits

- **Graph embeds can show "changed" with the same graph.** A notebook records each graph it shows together with the hash of the graph as the recording machine held it, paths included. The host hashes a graph with the paths of the folder it runs from (`{SAMPLES}` is filled in as `<folder>\samples\nrc`), so a graph that names a file by path (`nrc-storey-carbon-chart`, `nrc-dc-w1-verdicts`) shows `was <hash> -> now <hash>` after "Re-evaluate all" on any computer but the recording one. Its text and its results are identical, and the tables and views draw as `current`. Making the hash independent of the folder is a change to the notebook package and to the recorded notebooks, not to the release.
- **Names in the toolkit checkout.** The repository's own `.mcp.json` defines servers called `bimopen-ifc` and `bimopenflow-duckdb` too. Inside a source checkout Claude Code warns that they are defined in two scopes. Outside it, which is where the release is used, there is no conflict.
- **The language model is the user's.** `bimopen questions` and a question asked in `claude` spend tokens from the account Claude Code is signed in to, and the answers depend on that model; the release makes no call to a hosted service of its own.

## Building the release

On a source checkout (`node deps.mjs` done, the `Platonic.CSharp` packages packed, `npm ci` in `deps\bim-open-viewer` and `bimopenflow\web`):

```bash
node scripts/release/build-release.mjs --version 0.1.0     # artifacts/release/BimOpenToolkit-0.1.0-win-x64/ and the zip
node scripts/release/smoke-release.mjs artifacts/release/BimOpenToolkit-0.1.0-win-x64 --prepare
```

`build-release.mjs` publishes the studio, the IFC server, the Ask runner, and `ifc-to-bos` self-contained (`dotnet publish -r win-x64 --self-contained`) and merges them into one `bin\` (a file two publishes disagree about stops the build, except a newer servicing build of the same .NET library, which wins); publishes `bimopen.exe` as one compressed self-contained file; builds the studio pages and the live notebook pages with Vite, and the static notebook site (only for its notebooks and models); copies the tracked sample files; and writes the notices from the NuGet restore files, the runtime packs, and the source maps of the web build. `smoke-release.mjs` starts the published host from the folder, evaluates sample graphs, fetches the pages and every notebook, and calls an IFC tool through the published server; `--prepare` also waits for the host to build the NRC databases once, so the zip ships them built. `scripts/release/live-pages-smoke.mjs <host url>` opens the pages in a headless Edge or Chrome, draws every 3D view, and clicks "Re-evaluate all" in each notebook.

`.github/workflows/release.yml` does the same on `windows-latest` when a tag `v*` is pushed (and by hand from the Actions tab, where it keeps the zip as a run artifact): wizard unit tests, build, smoke, zip with a SHA-256 file, and attach both to the GitHub release. It needs the `deps.json` pin of `bim-open-flow` to include the `--web` host option (commit `931d172`).

## Verified on the development machine (2026-10-18)

Windows 11 Home 10.0.26200, x64, with the SDKs and Claude Code installed. The build was `0.0.0-dev.985eb3f5bf` (no tag): `BimOpenToolkit-0.0.0-dev.985eb3f5bf-win-x64.zip`, 117,299,250 bytes, 248 MB unpacked (`bin` 157 MB, `samples` 54 MB, `bimopen.exe` 34 MB, `web` 7 MB).

- The zip was unpacked into a folder outside the repository, and everything below ran from that folder with a separate `CLAUDE_CONFIG_DIR` (an empty Claude Code profile, not signed in) and a copy of the desktop app's settings file, so the registrations and sign-in of the real profile were not touched.
- `bimopen doctor` on the empty profile listed the missing registrations and the missing sign-in, and passed the host and IFC checks. `bimopen setup` (answering "continue without signing in") registered both servers and the skills and added them to the copied desktop file after saving a backup; a second run printed "already registered ... nothing changed" and left both files byte-identical. `claude mcp list` against that profile reported both servers `Connected`.
- `scripts/release/smoke-release.mjs --prepare`: the sample graph evaluates to `Ok`, `nrc.html`, `studio.html`, `notebook.html`, the 12 notebooks and the graph list are served, no Snowdon notebook is served, `nrc-q1-building-total` evaluates to `Ok` after the NRC databases were built, and `ifc_type_counts` through the published `bimopenmcp-ifc.exe` lists `IfcDoor`.
- `bimopen start` (also piped through `tail`, to check that it does not wait for the host) put 38 notebook graphs on the host; `bimopen stop` stopped it.
- `scripts/release/live-pages-smoke.mjs` in headless Edge against that host: 12 notebooks, 19 graph rows, every one of the 21 3D views drew, and after "Re-evaluate all" no embed was unavailable. The tallies and the two kinds of difference left are under "Known limits".
- One real question through Claude Code with a temporary MCP file that named the published `bimopen-ifc` (`claude -p --strict-mcp-config`, model Haiku, 4 turns, about 0.7 US cents): "How many IfcDoor elements ...?" was answered `14` from `ifc_entities_of_type` (`total: 14`) and `ifc_type_counts`.

Not verified: a computer with none of the toolchain (the checklist below); the Claude desktop app reading the registration (the file was written, the app was not restarted); `bimopen questions` (it spends tokens; the scorer's table for the nine questions is not in this repository, so there is nothing to compare it with here); the GitHub workflow (it needs the `deps.json` pin to move first); SmartScreen's reaction to the unsigned programs.

## Fresh-machine checklist

The development machine has Claude Code and the whole toolchain, and runs Windows 11 Home, which has no Windows Sandbox, so a true fresh machine could not be tried there. To be run once by the owner on a Windows 10 or 11 computer (a Windows 11 Pro machine with Windows Sandbox, a virtual machine, or a colleague's laptop) that has only Git and a user account, and recorded in a release-check note with the date and the machine:

1. The machine has no .NET SDK, Node, or git on PATH (`dotnet --list-sdks`, `node --version` fail). Claude Code is not installed.
2. Download the zip from the release page. Unzip it to `C:\BimOpen`. Double-click `bimopen.exe`. Record whether SmartScreen appears.
3. Setup stops at step 2 with the install command. Run that command in a new PowerShell window, run `claude`, sign in, close it. Press Enter in the setup window. Steps 2 to 5 finish with every line `[ ok ]`.
4. `bimopen doctor` prints "No problems found". Run `bimopen setup` again: the lines say "already registered ... nothing changed".
5. Open a new terminal in any folder and run `claude`. Ask: "How many doors are in C:\BimOpen\samples\nrc\duplex-enriched.ifc?" Claude calls `ifc_*` tools of `bimopen-ifc` and answers from a tool result.
6. `bimopen start`. The browser opens `nrc.html` with the twelve notebook cards. Open `nrc-eight-questions`: every table, chart, and 3D view is drawn. Press "Re-evaluate all": the status line ends "n current, 0 changed, 0 unavailable".
7. If the Claude desktop app is installed: run setup again, answer yes to the desktop question, restart the app, and ask the same question.
8. `bimopen questions` (spends tokens): `artifacts\nrc\transcript.md` holds the nine answers; compare them with the scorer's table.
9. `bimopen stop`. The page stops answering.
10. Move the folder to `C:\BimOpen2`. `bimopen doctor` says the servers point at another folder; `bimopen setup` fixes it.
