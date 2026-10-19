---
id: TKT-322
title: A Windows release of the whole system that runs with a local Claude instance: one download, one command, the notebook site and the NRC demos included
status: open
depends_on: [TKT-142, TKT-160]
owner: builder e2aa2b2c
fence: [scripts/release/, src/release/, tests/release/, .github/workflows/release.yml, docs/release.md, README.md, BimOpenToolkit.sln, bim-open-flow: src/flow/BimOpenFlow.Host/{HostConfig.cs, HostComposition.cs, StaticWeb.cs}, tests/flow/BimOpenFlow.Host.Tests/StaticWebTests.cs]
workflow: [W1, W2, W3]
created: 2026-10-18
kind: task
---

## Goal

A person at the NRC installs nothing but this release and Claude Code, signs in to Claude on their own machine, runs one command, and has the whole system: the host (the studio with the bim profile), the IFC MCP server and the dataflow MCP server, the IFC converter, the viewer, the notebook page with the NRC notebooks (`samples/notebooks`), the NRC sample data and graphs (`samples/nrc`, `samples/nrc-analyses`, `samples/checking-analyses`), the Ask runner (`src/studio/BimOpenMcp.Ifc.Ask`) driving the local Claude Code command line, and the walkthrough that the public GitHub Pages site shows, now with Re-evaluate working against the local host. No API key, no hosted service, no cloud: the language model is whatever Claude Code on that machine is signed in to, as the NRC rerun of 2026-10-17 already did.

Why: the NRC paper's reproducibility section promises that three commands repeat every result, and the planned notebook site (the paper folder's `planning/notebooks-plan.md`) shows results but cannot execute them. A release closes that gap for the NRC on Windows, the only platform the IFC stack builds on today. It also removes, for a user, the Platonic packages step and the `node deps.mjs` clone chain that a fresh source clone needs (README, Prerequisites).

## Acceptance criteria

- [ ] A GitHub release of this repository at a tagged tested set carries one Windows archive (zip or installer) built by a workflow on a Windows runner: self-contained .NET host, MCP servers, Ask runner, and converter (no SDK needed), the built web pages (studio, notebook, 3D pane) served by the host, the NRC samples and the notebooks, the node catalog, and NOTICE and LICENSE files for every bundled dependency.
- [ ] One command (`bimopen.cmd` or similar) starts the host with the bim profile and opens the notebook page at the NRC catalog in the default browser; a second starts the Ask runner on the nine questions through the local Claude Code command line, which the release detects (`claude` on PATH, signed in) and explains how to install if absent.
- [ ] Claude Code's MCP configuration for the two servers is written by the release (a `.mcp.json` the user points Claude Code at, or a documented one-line `claude mcp add`), so asking about a model works from a terminal as well as from the notebook page's Ask box.
- [ ] The NRC notebooks open from the release with every embed drawn, and Re-evaluate marks each graph embed current against the local host; the nine-question run reproduces the scorer's table on the bundled enriched file.
- [ ] A fresh Windows 11 machine with only Git, Claude Code, and the release passes the release's own check and the steps above, recorded in a release-check note with date and machine.
- [ ] The README is updated in the same commit as each chunk that changes what a user does: a "Windows release" section under "Build and run" (where to get it, what it contains, the one command, the Claude Code requirement, what still needs the SDK), "Prerequisites" rewritten to separate running the release from building from source, the "Tested sets" table gaining a release column, and the NRC repository's README pointing at the release. A chunk whose README line is missing is not done.

## Chunks (a follow-up; each its own commit with its check)

1. Self-contained publish of the host, the IFC and flow MCP servers, the Ask runner, and the converter (`dotnet publish -r win-x64 --self-contained`), with a smoke that starts the host from the published folder and evaluates one sample graph.
2. The static web builds (studio, notebook page, pane-3d) served from the published host; the NRC catalog as the notebook landing page.
3. The launcher scripts, the Claude Code detection, and the MCP configuration file.
4. A `release.yml` workflow on `windows-latest` that builds the archive at a tag, runs the smoke, and attaches it to the GitHub release; the archive carries third-party notices (TKT-144 settles which sample models may be redistributed; the Duplex and the public samples are fine, Snowdon is not).
5. The fresh-machine check, the README sections above, and the NRC repository's README pointer.

## Not in scope

A hosted multi-user service; Linux or macOS (the IFC stack is `net8.0-windows`); an installer that writes the registry; any API key handling.

## Progress (2026-10-18, builder e2aa2b2c)

`ticket.py claim` refused ("waits on TKT-142", the Pages action, which the release does not need), so owner and fence were written by hand.

Built: the host serves a web folder (`--web`, bim-open-flow 931d172: the pin in `deps.json` has to move to it); `scripts/release/` builds, smoke-tests, and zips the release folder; `src/release/BimOpen.Launcher` is `bimopen.exe` (setup, doctor, start, stop, questions) with 60 unit tests; `.github/workflows/release.yml`; `docs/release.md`; the README sections. Verified from an unzipped copy outside the repository with an empty Claude profile (see `docs/release.md`, "Verified on the development machine").

Left: a tag and the GitHub release; the fresh-machine run (`docs/release.md`, checklist), which is the box above; `bimopen questions` against the scorer's table; the NRC repository's README pointer; code signing.
