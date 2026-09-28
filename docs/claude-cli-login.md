# Log in the Claude command line

The Ask box in the DuckDB workflow studio, and the IFC ask, call Claude through the
Claude Code command line rather than the Anthropic API (`ASK_PROVIDER=claude-cli`; see
[bim-flow-mcp-demo.md](bim-flow-mcp-demo.md)). That command line needs its own sign-in,
separate from any API key. One command finds it, checks whether it is signed in, signs
it in if not, and sends one tiny request to prove the whole path works:

```powershell
node scripts/claude-login.mjs
```

## What you will see

```
Using C:\Users\you\AppData\Local\Packages\Claude_xxxxxxxx\LocalCache\Roaming\Claude\claude-code\2.1.281\claude.exe
Chosen because: newest bundled copy (packaged, version 2.1.281)
Already logged in.
Sending a tiny test request (model haiku)...
Answered: ok

Set this for the host: ASK_CLAUDE_CLI=C:/Users/you/AppData/Local/Packages/Claude_xxxxxxxx/LocalCache/Roaming/Claude/claude-code/2.1.281/claude.exe
```

If it is not signed in, it opens the browser sign-in for you (`auth login`) and checks
again once you finish. The last line is the value to set for `ASK_CLAUDE_CLI` before
starting the host, with forward slashes so it can go straight into `.claude/launch.json`
or a shell variable.

Flags:

- `--check` — after a successful find (whether or not a login was needed), always sends
  the tiny test request. This happens automatically right after a fresh login too.
- `--dry-run` — never runs the interactive `auth login`; if not signed in, it prints
  what it would run instead of waiting on a browser. Use this to see the discovery
  result without touching your login state.

## What it looks for, in order

1. `ASK_CLAUDE_CLI`, if set — used as-is if the file exists, otherwise reported as an
   error (it is not silently skipped: a stale path should be visible, not swallowed).
2. `claude.exe` or `claude.cmd` on `PATH` — but only if it actually runs a `--version`
   check. A `PATH` hit that does not run is treated as absent and the search continues
   (see "the packaged-app folder" below for why this happens).
3. The newest version folder under both the packaged (MSIX) location and the plain
   `%APPDATA%` location, compared numerically (`2.9.0` beats `2.1.281`).

If nothing works, the script prints every candidate it looked at and what was wrong
with each one, plus the install command.

## Troubleshooting

**"Unexpected token" when you paste a command with a quoted path in PowerShell.**
PowerShell needs `&` before a quoted executable path: `& "C:\path\to\claude.exe" auth
status` works, `"C:\path\to\claude.exe" auth status` alone does not. This script never
makes you type a path, which is one reason it exists.

**`/login` does nothing from an ordinary shell.** `/login` is a command typed *inside*
an interactive `claude` session, not a shell command. From a shell, the equivalent is
`claude auth login` (this script runs that for you). To check without logging in,
`claude auth status` prints JSON with `"loggedIn": true` or `false`.

**The Claude desktop app's bundled copy is not where it looks like it should be.**
Claude Code processes started *by* the desktop app see it at
`%APPDATA%\Claude\claude-code\<version>\claude.exe`. But the desktop app is an
MSIX-packaged Windows app, and MSIX gives packaged apps a private, virtualized view of
`%APPDATA%`; an ordinary terminal you open yourself does not get that view, so that path
looks empty or missing from PowerShell or Git Bash even though the app can see files
there. The real, unvirtualized location is
`%LOCALAPPDATA%\Packages\Claude_<id>\LocalCache\Roaming\Claude\claude-code\<version>\claude.exe`.
This script checks both locations and picks the numerically newest version it finds
across them, so you never need to know which one has the current copy.

**`~/.local/bin/claude` or `~/.local/bin/claude.cmd` (added 2026-09-27) run the newest
copy under `%APPDATA%\Claude\claude-code` only.** From an ordinary terminal, that
folder is the virtualized one described above, so these launchers can fail there even
though they work from a terminal the desktop app itself opens (which is why they seemed
fine when first added). If you use one of these launchers directly and it reports
nothing found, run `node scripts/claude-login.mjs` instead — it also checks the
packaged location these launchers do not, and reports the exact `ASK_CLAUDE_CLI` value
you can hard-code as a workaround. The fix belongs in the launchers themselves (adding
the same `%LOCALAPPDATA%\Packages\Claude_*\...` fallback), not in this repository, since
they live under your home directory, not the checkout.

**A stale `ASK_CLAUDE_CLI` in `.claude/launch.json`.** That file hard-codes a version
path, which breaks on the next Claude desktop app update (a new version folder appears
and the old one may be removed). Re-run `node scripts/claude-login.mjs` after an update
and paste its last line's value back in. The host's own `ClaudeCliLocator` does not yet
fall back to the packaged location the way this script does; TKT-92 tracks teaching it
the same search, so `launch.json` would no longer need a literal path at all.

## Confirming it worked

`node scripts/claude-login.mjs --check` (or a plain run when a login just happened)
sends `-p "Reply with the single word ok" --model haiku` and reports whatever came
back. From a neutral directory this reliably answers `ok`; from a directory carrying a
`CLAUDE.md` (this repository's, or your own `~/.claude/CLAUDE.md`), the model may reply
in character instead of literally — that is the model being helpful with the extra
context, not a broken login, so the script only checks that something came back within
60 seconds, not the exact word. Either way, once you see the `ASK_CLAUDE_CLI=` line,
the studio's Ask box and the IFC ask are ready to use the same executable.
