# Core BIM DuckDB export

This package exports a `BuildingProjection` to DuckDB. `CoreSchema` discovers 83 public core records with self-typed IDs and their 862 domain properties. `ProjectionColumn` expands those properties into typed SQL columns; the database column count is larger because composite values and provenance have separate columns.

`IBuildingProjectionWriter` separates the projection from its storage implementation. `DuckDbProjectionWriter` creates every core table and writes the projection collections presently mapped from BOS.

- Known facts expose their typed value under the domain field name. Missing facts use SQL NULL. Companion `_assurance`, `_reason`, `_explanation`, and `_evidence` columns preserve the distinction and supporting evidence.
- Measurements expose numbers in the core model's canonical units; durations use INTERVAL. Composite values flatten into prefixed columns, such as `element_name` and `element_object_id`.
- Keys use VARCHAR, retaining snapshot-qualified identity. Collections use native lists, with structs for composite items. Link sets expose key lists plus `_completeness` and `_evidence` columns.
- Property-value variants have a `_kind` discriminator and separate typed variant columns.

No JSON columns are emitted. Regenerate existing exports to migrate from the previous JSON layout. Numeric storage policy still belongs to the mapper: unknown units produce NULL measurements and an explicit reason, rather than guessed numbers.

The focused tests verify the complete schema and typed values, nulls, arithmetic, relationships, and evidence. The Snowdon integration test verifies architectural row counts and numeric width totals against the mapped source model.
