---
id: TKT-9
title: One start page and one supported first run
status: done
depends_on: []
owner: small-job-builder
fence: [README.md, docs/DEMOS.md, docs/bim-flow-startup.md, .claude/launch.json, bimopenflow/web/package.json, src/flow/BimOpenFlow.Host/**]
---

## Acceptance criteria

- [ ] A newcomer with the prerequisites installed reaches a running table graph from a clean checkout by following one page, with one documented command per service
- [ ] The host's default port and the editor's proxy target agree, or the mismatch is impossible (one setting)
- [ ] A dependency preflight names what is missing (Node version, .NET SDK, submodules, private model) before anything starts

Serves W1 (the clean-clone start) and, through it, every other workflow. REPOSITORY-HANDOFF.md 'Launch instructions' lists the traps: host default 5210 against an editor proxy expecting 5214, two commands in two terminals, npm run demo launching the older alpha gallery, a private Snowdon path in Documents. Professional starts at minute one.

## Result (2026-09-26, commit bd889f3)

docs/START.md is the one page; the host's default port is now 5214, the editor proxy's target, so the mismatch is gone without a second setting; scripts/preflight.mjs names the missing prerequisite (Node per Vite's engines field, .NET 8 SDK, five submodules, the private model as informational). Verified live: host with no --port flag, editor with no override, catalog request through the proxy returned 200. Left: `npm run demo` in viz/package.json still opens the alpha gallery (documented as not the first run; rename it when someone holds that file).
