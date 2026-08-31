# Ara3D.NodeGraph.Migrations

Version-to-version upgrades for graph documents (`.dfg.json`).

This lives outside `Ara3D.NodeGraph` on purpose: migrations work on raw JSON
text, so old formats — including shapes the current `GraphDocument` model
cannot represent — never complicate the current document model or its IO.
Every breaking format change ships a mechanical migration here, per the
versioning policy in `spec/dataflow-graph/README.md`.

## Usage

```csharp
var currentJson = GraphMigrator.Current.MigrateToCurrent(oldJson);
```

`MigrateToCurrent` reads `formatVersion` from the JSON, chains registered
`IGraphMigration` steps up to `GraphFormat.Version`, and returns canonical
text (via `GraphDocumentIO`). A document already at the current version is
returned byte-for-byte unchanged. Newer or unreachable versions produce a
`FormatException` with a clear message.

The production registry (`GraphMigrator.Current`) is empty: format 0.1.0 is
the first release, so there is nothing to migrate from yet. The seam is
proven by tests using fake migrations.
