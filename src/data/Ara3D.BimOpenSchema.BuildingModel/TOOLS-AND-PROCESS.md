# Core-model process

The C# records in this project are the authoritative core BIM definitions. The older generated 23-table review contract remains a separate historical prototype and is not synchronized with this project.

The core is developed from authoring-export questions: schedules, spatial navigation, physical component properties, systems connectivity evidence, materials, quantities and geometry references. A candidate record must describe exported authoring intent or an explicitly mapped source observation.

`Fact<T>` and `LinkSet<T>` preserve unavailable values and relationship coverage. They are semantic definitions, not an instruction to hydrate an entire portfolio as nested in-memory objects. BFAST preparation, database projections, indexes and selective hydration remain separate storage work.

The model imports the shared Platonic analyzer configuration through `tools/bim-data-model/Platonic.props`. Tests may use reflection and file access under their explicit impure boundary; production definitions remain immutable records and value types.

Commercial, maintenance, compliance and analysis-result contracts must be separate packages. They may reference the core's snapshot and object identities but must not add their state to this assembly.
