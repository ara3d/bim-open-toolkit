# BFAST on the columnar path

Node v22.13.1, win32. Warm up then 5 repetitions.

### Steps of one load

| Step | Median ms | Samples |
|---|---:|---|
| parse container and render tables | 87.8 | 89, 92, 77, 79, 88 |
| decode entity ids, names and categories | 101.7 | 137, 121, 102, 100, 84 |
| decode entity ids only | 21.0 | 25, 26, 21, 19, 20 |
| object rows from the entity table and placements | 5.1 | 10, 12, 5, 5, 5 |
| mesh list as views on the file | 93.8 | 93, 98, 94, 105, 80 |
| instance columns | 105.2 | 122, 93, 96, 118, 105 |
| whole load, metadata full | 454.9 | 410, 477, 514, 455, 446 |
| whole load, metadata none | 296.4 | 302, 354, 262, 296, 270 |
| validateLoadedModel over the whole model | 128.0 | 128 |

### The model

- file bytes: 111,630,208
- objects: 51,139
- geometryFreeObjects: 28,976
- meshes: 171,569
- instances: 456,598
- drawnInstances: 456,598
- meshVertices: 2,246,960
- meshTriangles: 2,190,963
- objects with a name: 48,844
- objects with a category: 31,679
- diagnostics: formats/dropped-hidden-instances, formats/assumed-coordinates
