# BimOpen.Launcher

`bimopen.exe`, the wizard and launcher of the Windows release (TKT-322, `docs/release.md`). One self-contained file; it reads nothing from the repository.

| Command | Does |
|---|---|
| `bimopen setup` (also a double-click) | Six steps: check the computer, find Claude Code, choose a models folder, register the two MCP servers and the two skills, run a self-check, offer to start |
| `bimopen doctor` | The same checks, changing nothing, with a fix under each failure |
| `bimopen start` / `stop` | The host with the `bim` profile on a free port and the NRC notebook page in the browser; stop it |
| `bimopen questions` | The Ask runner on the nine NRC questions through the `claude` command |

| File | Role |
|---|---|
| `Program.cs` | Argument dispatch, and the real console, process, and browser |
| `Wizard.cs`, `Doctor.cs`, `HostCommands.cs`, `QuestionsCommand.cs` | The commands, as functions of a `Context` |
| `Context.cs`, `Machine.cs`, `Terminal.cs`, `ProcessRunner.cs`, `SelfCheck.cs` (`ISelfCheckPorts`) | The seams a test replaces: console, environment and file system, processes, the host and the MCP server |
| `SystemChecks.cs`, `ClaudeFinder.cs`, `ClaudeCli.cs`, `ClaudeSteps.cs` | Windows, folder, disk; finding `claude`; its version and sign-in (`claude auth status --json`, no tokens) |
| `McpServer.cs`, `ClaudeConfig.cs`, `Registration.cs`, `RegistrationSteps.cs`, `DesktopConfig.cs`, `Skills.cs` | What is registered where, compared before anything is written, so a second run changes nothing |
| `Settings.cs`, `Layout.cs`, `HostArguments.cs`, `HostProcess.cs`, `HostState.cs`, `ReleaseCopy.cs` | `bimopen.json`, the release folder's paths, the host's command line and process |
| `McpStdioClient.cs`, `RealSelfCheckPorts.cs`, `HostApi.cs` | The self-check against the real host and IFC server; requests to a host |
| `NotebookGraphs.cs` | The graphs the sample notebooks read (ids `nb-...`), put on a fresh host from the notebooks and `samples/notebooks/graphs`, so the first Re-evaluate finds them |
| `Finding.cs`, `Release.cs` | A check's outcome and how it prints; `release.json` |

Tests are in `tests/release/BimOpen.Launcher.Tests`: fakes stand in for Claude, the console, and the host, so no real Claude is needed.
