# BFAST against BOS, whole load

Node v22.13.1, win32. Warm up then 5 repetitions, 3 for the steps that prepare the archive.

### Whole load

| Step | Median ms | Samples |
|---|---:|---|
| prepare the BOS archive as BFAST | 1686.1 | 1694, 1686, 1590 |
| BFAST, whole load | 393.5 | 471, 390, 394, 361, 409 |
| BOS, whole load including preparation | 2126.0 | 2126, 2089, 2140 |

### Sizes and counts

- BOS bytes: 9,362,255
- prepared BFAST bytes: 111,630,208
- BFAST on disk bytes: 111,630,208
- BFAST objects: 51,139
- BOS objects: 51,139
- BFAST instances: 456,598
- BOS instances: 456,598
