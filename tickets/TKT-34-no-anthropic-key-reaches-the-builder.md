---
id: TKT-34
title: No Anthropic key reaches the builder session for TKT-8/TKT-18 Claude runs
status: open
depends_on: []
owner:
fence: [tickets/**]
---

## Acceptance criteria

- [ ] Both a running node scripts/ask-bim-flow.mjs --file samples/ask/requests.txt with ASK_PROVIDER=anthropic and a bimopenmcp-ifc-ask run against samples/nrc/questions.txt need ANTHROPIC_API_KEY or ANTHROPIC_API_KEY_FILE reaching the process; both must succeed once a key is available.

Get-ChildItem env: (via a freshly spawned PowerShell) shows only ANTHROPIC_BASE_URL; neither ANTHROPIC_API_KEY nor ANTHROPIC_API_KEY_FILE reaches a new shell. src/studio/BimOpenFlow.Ask has no .env-style loader (grep for KEY_FILE only finds the two C# constants), and no Anthropic key file exists under C:\dev\keys. A User-scope ANTHROPIC_API_KEY registry value does exist, but it is not inherited by new process trees on this machine (a fresh PowerShell does not see it either), so it does not reach a spawned host or CLI process without exporting it by hand. Per instructions the builder must not use a key found this way and must not ask the owner for it; both TKT-8's Claude measurement and TKT-18's Q8 rerun are blocked until a key reaches a freshly spawned shell (for example by re-logging in after setx, or setting ANTHROPIC_API_KEY_FILE to a file that exists).
