---
id: TKT-19
title: The walkthrough's Duplex half and the paper's eight answers run in CI on every push
status: claimed
depends_on: []
owner: small-job-builder
fence: [gates/**, .github/workflows/build.yml, bimopenflow/web/package.json, tests/flow/BimOpenFlow.NrcWorkflows.Tests/**]
---

## Acceptance criteria

- [ ] CI (.github/workflows/build.yml, without continue-on-error for this step) runs the Duplex half of the walkthrough and NrcWorkflows.Tests, asserting the expected answers to the paper's eight questions; a changed answer fails the push
- [ ] The Snowdon half is skipped with a named reason when the private model is absent, and never reported as passing

Serves W6 and guards W2, W4, and W5. docs/nrc-walkthrough.md and artifacts/nrc-walkthrough/README.md: the walkthrough runs by hand in 291 s, its Snowdon half needs the private model, and .github/workflows/build.yml runs on GitHub's Windows runner with continue-on-error, so no push can produce every figure; the Duplex half can. README.md 'Maturity' says the publishing chain has no end-to-end gate.
