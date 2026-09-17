# BFAST against BOS, whole load

Node v22.13.1, win32. Warm up then 5 repetitions, 3 for the steps that prepare the archive.

### Whole load

| Step | Median ms | Samples |
|---|---:|---|
| prepare the BOS archive as BFAST | 1380.8 | 1381, 1405, 1343 |
| BFAST, whole load | 309.1 | 309, 309, 342, 349, 300 |
| BOS, whole load including preparation | 1658.1 | 1659, 1658, 1657 |

### Sizes and counts

- BOS bytes: 9,362,255
- prepared BFAST bytes: 111,630,208
- BFAST on disk bytes: 111,630,208
- BFAST objects: 51,139
- BOS objects: 51,139
- BFAST instances: 471,462
- BOS instances: 471,462
