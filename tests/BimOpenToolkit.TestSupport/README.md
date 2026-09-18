# BimOpenToolkit.TestSupport

Shared helpers for every test project in `tests/`: `RepoPaths` (the checkout
root and its `samples/`, `data/`, and `artifacts/` folders, located from the
source file so out-of-tree build output still works) and `MiniIfc` (a
fourteen-line IFC4 wall file and a `Document(...)` builder for other
hand-written STEP fixtures).

It references no `src` project and no test framework, which is why the
layering rule lets `data`, `flow`, `mcp`, and `studio` tests all reference it.
