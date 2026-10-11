# Graph text

Graph text is a deterministic printout of a graph document and its evaluation, so a test or an agent can check a built graph without a screenshot (TKT-57). The library is `deps/bim-open-flow/src/flow/BimOpenFlow.GraphText`; its README has the entry point and options. The sample-flow golden files (`tests/studio/BimOpenFlow.SampleFlows.Tests/golden/`) are graph text; `docs/sample-flows-test.md` says how to re-approve them.

```
dfg 0.1.0;
// bim-discipline-mix   graph e9c0323bf149
inputs model: FilePath = "{SAMPLES}/sample.bos" now "{MODELS}/sample.bos";
model = value.path@1(path: "$model");
  // Ok  Text "{MODELS}/sample.bos"
elements = bim.elements@1(path: model.path);
  // Ok  table 20 rows x 14 cols  sha 5f10f12d635b
```

## Lines

- `dfg 0.1.0;` is the format header. The next line is a comment with the graph's name and hash.
- `inputs name: Kind = "default", ...;` lists the graph's inputs (TKT-204), sorted by name, before any node. Each entry is the input's name, its parameter kind (FilePath, Text, Number, Integer or Boolean) and its default. When the evaluation used a different value, the entry ends with `now "value"`. A graph with no inputs prints no `inputs` line. A node parameter whose whole value is `$name` reads that input, and prints as written.
- One binding per node, `id = kind@version(port: node.port, param: "value");`, in evaluation order. A comment block under each binding gives its status and an output digest.

Because the graph hash covers the declared inputs but not the values in use, one graph run on two buildings keeps one hash; the `now` text is what tells the two printouts apart.
