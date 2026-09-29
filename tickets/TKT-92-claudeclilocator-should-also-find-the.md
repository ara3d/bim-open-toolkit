---
id: TKT-92
title: ClaudeCliLocator should also find the packaged (MSIX) Claude Code copy, so launch.json needs no hard-coded version
status: done
depends_on: []
owner: wave-w4
fence: [src/studio/BimOpenFlow.Ask/ClaudeCli/ClaudeCliLocator.cs, tests/studio/**, docs/bim-flow-mcp-demo.md, docs/START.md]
---

## Acceptance criteria

- [x] ClaudeCliLocator.Find also checks %LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude\claude-code\<version>\claude.exe (the MSIX-packaged desktop app's real location, invisible to an ordinary terminal at %APPDATA%\Claude\claude-code), comparing version folders numerically the same way scripts/claude-login.mjs's chooseClaudeCli does
- [x] When both the packaged and %APPDATA% locations have a copy, the numerically newest wins across both, not just within one
- [x] A PATH hit is verified to actually run (a fast --version check) before it is trusted, since ~/.local/bin/claude(.cmd) launchers can point at a virtualized path an ordinary process cannot see
- [x] docs/bim-flow-mcp-demo.md and docs/START.md no longer need to tell a user to hard-code ASK_CLAUDE_CLI to a version path in .claude/launch.json; they instead point at scripts/claude-login.mjs (docs/claude-cli-login.md) for one-command discovery and login

Follows scripts/claude-login.mjs (TKT-80), a Node-side discovery helper built because .claude/launch.json currently hard-codes ASK_CLAUDE_CLI to a version path that breaks on every Claude desktop app update. ClaudeCliLocator.cs today only checks ASK_CLAUDE_CLI, PATH, and %APPDATA%\Claude\claude-code — never the MSIX-packaged folder — so it cannot find the copy scripts/claude-login.mjs found as this ticket was written (packaged, version 2.1.281, on a machine where %APPDATA%\Claude\claude-code also happens to be visible only because the shell that wrote this ticket inherited the desktop app's package identity; an ordinary terminal would not see it). Bringing the same fallback into the C# locator removes the last reason launch.json needs a literal path.
