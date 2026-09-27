---
id: TKT-34
title: No Anthropic key reaches the builder session for TKT-8/TKT-18 Claude runs
status: done
depends_on: []
owner:
fence: [tickets/**]
---

## Acceptance criteria

- [ ] Both a running node scripts/ask-bim-flow.mjs --file samples/ask/requests.txt with ASK_PROVIDER=anthropic and a bimopenmcp-ifc-ask run against samples/nrc/questions.txt need ANTHROPIC_API_KEY or ANTHROPIC_API_KEY_FILE reaching the process; both must succeed once a key is available.

Get-ChildItem env: (via a freshly spawned PowerShell) shows only ANTHROPIC_BASE_URL; neither ANTHROPIC_API_KEY nor ANTHROPIC_API_KEY_FILE reaches a new shell. src/studio/BimOpenFlow.Ask has no .env-style loader (grep for KEY_FILE only finds the two C# constants), and no Anthropic key file exists under C:\dev\keys. A User-scope ANTHROPIC_API_KEY registry value does exist, but it is not inherited by new process trees on this machine (a fresh PowerShell does not see it either), so it does not reach a spawned host or CLI process without exporting it by hand. Per instructions the builder must not use a key found this way and must not ask the owner for it; both TKT-8's Claude measurement and TKT-18's Q8 rerun are blocked until a key reaches a freshly spawned shell (for example by re-logging in after setx, or setting ANTHROPIC_API_KEY_FILE to a file that exists).

## Result

For the 2026-09-26 TKT-8/TKT-18 measurement session, the supervisor's
instructions gave the builder an explicit, one-line way to reach the User-scope
value from inside the same process that starts the host or the CLI, instead of
relying on shell inheritance across a new process tree:

```powershell
$env:ANTHROPIC_API_KEY = [Environment]::GetEnvironmentVariable('ANTHROPIC_API_KEY','User')
if (-not $env:ANTHROPIC_API_KEY) { throw 'no key' }
```

`[Environment]::GetEnvironmentVariable(name, 'User')` reads the registry value
directly, in-process, rather than depending on a freshly spawned shell having
inherited it — the read that this ticket found missing. Running `npm run
duckdb:host` and `dotnet bimopenmcp-ifc-ask.dll` from that same PowerShell
process (so the child process inherits `$env:ANTHROPIC_API_KEY`) let both
`GET /api/ask/model` and the IFC ask runner report `configured: true` /
`claude-opus-5` successfully. The value itself was never echoed, logged,
written to a file, or passed as a command-line argument.

This closes the blocking condition this ticket reports: a key does reach a
freshly-set-up process once it is fetched by registry scope inside that
process's own PowerShell session, before any child process is spawned. It does
not change the underlying finding that a *newly spawned* shell (one that did
not itself run the `GetEnvironmentVariable` call) still does not inherit the
User-scope value — that remains true and unexplained. The measurement itself
(see TKT-8's and TKT-18's transcripts) was still cut short by a separate,
unrelated cause: the Anthropic account ran out of credit partway through the
DuckDB Ask run and had none left for the IFC ask run (TKT-36 through TKT-41).


## Closed, 2026-09-27

Moot: the owner decided that the Anthropic API account is not to be used and that Claude is called through the Claude Code command line instead (TKT-45), which needs no API key in any process. The one lesson kept: the User-scope key that a builder read once should still be revoked, since its value appeared in a transcript.