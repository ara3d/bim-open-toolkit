---
id: TKT-155
title: Re-evaluate compares numbers exactly, so p02's pipe-length sums show changed from floating-point summation order
status: open
depends_on: []
owner:
fence: [bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/**]
kind: defect
---

## Acceptance criteria

- [ ] Re-evaluating the p02-digitalhub-heating notebook against the same data reports no changed turns

Found in phase 6. The pipe-length sums in p02 differ in the last digits between runs because the order of summation is not fixed, and the comparison treats any difference as a change. Decide between a relative tolerance for floating-point columns and a fixed summation order, and say which in the fix.
