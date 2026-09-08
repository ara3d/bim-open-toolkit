# BFAST against BOS, whole load

Node v22.13.1, win32. Warm up then 5 repetitions, 3 for the steps that prepare the archive.

### Whole load

| Step | Median ms | Samples |
|---|---:|---|
| prepare the BOS archive as BFAST | 1649.9 | 1650, 1676, 1557 |
| BFAST, whole load | 353.3 | 352, 353, 421, 349, 422 |
| BOS, whole load including preparation | 2082.1 | 2133, 2082, 2052 |

### Sizes and counts

- BOS bytes: 9,362,255
- prepared BFAST bytes: 111,630,208
- BFAST on disk bytes: 111,630,208
- BFAST objects: 51,139
- BOS objects: 51,139
- BFAST instances: 456,598
- BOS instances: 456,598
