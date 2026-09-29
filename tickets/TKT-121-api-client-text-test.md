---
id: TKT-121
title: The api-client test covers getAnalysisText, so web-smoke passes again
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/api-client/test/apiClient.test.ts]
---

## Acceptance criteria

- [ ] apiClient.test.ts's calls table has a getAnalysisText entry that checks GET /api/analyses/{id}/text, and the mode query if the contract declares one
- [ ] All api-client tests pass (21 today, one failing) and gates/web-smoke.mjs passes end to end

Found 2026-09-28 while building TKT-112 and TKT-116. Commit 130c910 (TKT-57) added GET /api/analyses/{id}/text to contracts/contracts.json and getAnalysisText to the client, but not to the test's calls table, so 'covers every fetch-backed endpoint' compares 14 calls with 15 contract endpoints and fails. This is the only failure in gates/web-smoke.mjs, so the gate has been red since then and hides any new failure.
