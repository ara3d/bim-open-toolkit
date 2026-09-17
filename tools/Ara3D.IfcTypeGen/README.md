# Ara3D.IfcTypeGen

Generates the entity, interface, enum, alias, and schema source files in
`src/Ara3D.IfcTypes` from the buildingSMART EXPRESS schema files, using the
Parakeet EXPRESS grammar.

**This project is not in the solution and does not build against the
published Parakeet packages.** It was written against a Parakeet EXPRESS
grammar with `TypeBlocks`, `EntityBlocks`, and `TypeDecl` rules and a full
entity rule. The `Ara3D.Parakeet.Grammars` 1.4.5 package on NuGet, and the
Parakeet checkout in the sibling `toolchain` folder, both have only the
earlier stub grammar. The SDK's `toolchain/parakeet` folder that the project
used to reference is not checked in. The source is kept here as the record of
how `src/Ara3D.IfcTypes` was produced; regenerating needs that grammar.

When the grammar is available, the generator is an explicit NUnit test:

```bash
IFC_EXPRESS_DIR=C:/path/to/express dotnet test tools/Ara3D.IfcTypeGen --filter TestGenerate
```

`IFC_EXPRESS_DIR` must hold `IFC2X3.exp`, `IFC4.exp`, and `IFC4X3.exp`. The
files are published by buildingSMART and are not committed here. Output goes to
`src/Ara3D.IfcTypes` and overwrites the `*.g.cs` files there.
