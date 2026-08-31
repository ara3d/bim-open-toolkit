# Architecture

Split modules early and aggressively — prefer many small modules over a few large ones, even before size forces the issue. Small modules keep dependencies explicit, reduce coupling, make testing and refactoring cheaper, and let parallel agents work without stepping on each other.

# Coding guidelines

Reference styles: C# follows Ara3D.SDK (`studio/ara3d-sdk`, full guide in `docs/csharp-style-guide-for-agents.md` there); TypeScript follows platonic-ts (`platonic-ts/docs/style-guide.md`).

## Both languages

- Immutable data, pure functions, composition over inheritance. Data first, behavior second.
- One concern per file, named after the concern. Small, dense files (~100–300 lines max).
- Validate at the edge, trust inside — no defensive checks for cases the types already exclude. Ambient values (time, randomness, env, IO) are parameters, never reached for in core code.
- No speculative abstraction: write the concrete thing; abstract at the third use, not the first.
- Comments say why, never what or when — no history, no diff narration, no restating the code. Doc comments only where behavior is genuinely non-obvious.
- Ban meaningless names: `Manager`, `Helper`, `Util`, `Service`, `Handler`, `Info`, `Data`, `Base`. Verbs for functions, nouns for types.
- Test the exported contract with plain data in/out, not internal helpers.

## C#

- `IReadOnlyList<T>` for collection params/returns — never `IEnumerable<T>`, never expose `List<T>`.
- No setters on domain types; `readonly record struct` for small values, `sealed` classes, `readonly` fields.
- Behavior in `static` extension methods; APIs chain as pipelines (`mesh.Triangulate().WeldVertices()`).
- Expression-bodied members (`=>` on next line, indented); `var` everywhere; Allman braces; file-scoped namespaces.
- No LINQ in hot paths — indexed `for`, preallocated buffers; keep the imperative loop private behind a functional surface.
- No async, DI containers, or attribute frameworks in core libraries — application edges only.

## TypeScript

- Strict compiler settings; no `any`, no classes, no `enum` (string-literal unions), `type` not `interface`, `undefined` not `null`.
- `const` arrow functions, not `function` declarations; exported functions declare their return type; named exports only.
- Everything `readonly` — every record field, every array in a signature.
- No `throw` in core code: encode failure in the return type as a purpose-built discriminated union (not a generic `Result<T, E>` stack). Errors carry data (discriminants and fields), not prose.
- Build values with `filter`/`map`/`reduce` pipelines, not mutable accumulators.
- Pure core / IO root split: core modules never touch fs, network, clock, console, or env — that lives in composition-root files only.
