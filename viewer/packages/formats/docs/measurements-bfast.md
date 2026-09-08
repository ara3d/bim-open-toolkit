# BFAST on the columnar path

Node v22.13.1, win32. Warm up then 5 repetitions.

### Steps of one load

| Step | Median ms | Samples |
|---|---:|---|
| parse container and render tables | 83.0 | 83, 77, 99, 81, 84 |
| decode entity ids, names and categories | 87.3 | 109, 92, 79, 87, 87 |
| decode entity ids only | 19.6 | 19, 21, 19, 20, 21 |
| object rows from the entity table and placements | 7.5 | 8, 8, 4, 8, 7 |
| mesh list as views on the file | 72.7 | 64, 85, 65, 73, 84 |
| instance columns | 93.0 | 97, 109, 79, 93, 77 |
| whole load, metadata full | 378.5 | 375, 426, 333, 378, 427 |
| whole load, metadata none | 267.6 | 310, 239, 288, 251, 268 |
| validateLoadedModel over the whole model | 153.0 | 153 |

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
- diagnostics: formats/dropped-hidden-instances: 14864 placements are marked hidden in the file and are not instance rows; formats/assumed-coordinates: BFAST records no units or up axis; the model is reported as Z up with unknown units
