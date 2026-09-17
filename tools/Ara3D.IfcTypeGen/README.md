# Ara3D.IfcTypeGen

Generates the entity, interface, enum, alias, and schema source files in
`src/Ara3D.IfcTypes` from the buildingSMART EXPRESS schema files, using the
Parakeet EXPRESS grammar.

Parakeet comes from the `submodules/parakeet` submodule (`ara3d/parakeet`),
which also carries the schema files under `input/exp` (`IFC2X3.exp`,
`IFC4.exp`, `IFC4X3.exp`) and the test helpers that locate them. The generator
is an explicit NUnit test, so it runs on demand and never in a normal test pass:

```bash
dotnet test tools/Ara3D.IfcTypeGen --filter TestGenerate
```

It takes about a minute and overwrites the `*.g.cs` files in
`src/Ara3D.IfcTypes`. Run it after changing the grammar or the schema files,
then review the diff; on an unchanged input the output is byte-identical.
