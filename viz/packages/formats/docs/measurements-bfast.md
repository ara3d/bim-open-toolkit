# BFAST on the columnar path

Node v22.13.1, win32. Warm up then 5 repetitions.

### Steps of one load

| Step | Median ms | Samples |
|---|---:|---|
| parse container and render tables | 73.6 | 80, 74, 69, 74, 66 |
| decode entity ids, names and categories | 81.4 | 86, 90, 69, 65, 81 |
| decode entity ids only | 16.1 | 19, 13, 16, 16, 17 |
| object rows from the entity table and placements | 4.3 | 7, 7, 4, 4, 4 |
| mesh table over the file buffers | 24.7 | 30, 24, 25, 26, 24 |
| instance columns | 79.4 | 76, 79, 76, 80, 86 |
| whole load, metadata full | 283.0 | 283, 276, 300, 311, 269 |
| whole load, metadata none | 184.0 | 196, 184, 204, 182, 177 |
| validateLoadedModel over the whole model | 110.9 | 111 |

### The model

- file bytes: 111,630,208
- objects: 51,139
- geometryFreeObjects: 25,464
- meshes: 171,569
- instances: 471,462
- drawnInstances: 471,462
- hiddenInstances: 14,864
- meshVertices: 2,246,960
- meshTriangles: 2,190,963
- objects with a name: 48,844
- objects with a category: 31,679
- diagnostics: formats/hidden-instances: 14864 placements are marked hidden in the file and are rows with visible 0; formats/assumed-coordinates: BFAST records no units or up axis; the model is reported as Z up with unknown units
