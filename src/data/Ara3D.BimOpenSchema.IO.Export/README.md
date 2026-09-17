# Ara3D.BimOpenSchema.IO.Export

Writes an `IDataTable` to files people open elsewhere: Excel (`ExcelUtils`,
via ClosedXML), and CSV, Markdown, HTML, and SQLite (`DataTableExportUtils`).
Split out of `Ara3D.BimOpenSchema.IO` so the archive reader does not carry
ClosedXML and SQLite. Nothing here depends on the schema types; the project
keeps the `Ara3D.BimOpenSchema.IO` namespace so callers only change a
reference.
