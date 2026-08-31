# Ara3D.DataFlowEngine.Expressions

The expression language used by Expression-kind parameters on derive/filter/what-if
nodes: a hand-written recursive-descent parser, a static type checker, and a
deterministic evaluator over the scalar value kinds (Boolean, Integer, Number, Text).

The language is defined by `CONTRACTS.md` (frozen seam "Expression language") and
elaborated in `spec/dataflow-graph/expressions/expressions.md`. Highlights:

- Literals: `true`/`false`, Int64 integers, IEEE doubles, `'text'`/`"text"`, `null`.
- Identifiers: bare (`[A-Za-z_][A-Za-z0-9_]*`) or bracket-quoted (`[Fire Rating]`,
  `]]` escapes `]`). Keywords (`and or not true false null`) are lowercase,
  case-sensitive, and not usable as bare identifiers.
- Precedence (high to low): unary `-`/`not`; `* / %`; `+ -`; `&` (text concat);
  comparisons; `and`; `or`; `?:` (right-assoc). Binary operators left-assoc.
- Static typing: `+ - *` Integer if both Integer else Number; `/` always Number;
  `%` Integer only; Integer widens to Number. Null propagates through every
  operator; `coalesce` returns the first non-null argument.
- Builtins: `abs min max round floor ceil len lower upper contains startswith
  endswith coalesce`.

Usage: `Expression.Parse(text).Check(environment).Eval(lookup)`. Parse and type
errors carry character offsets and are collected, not thrown; evaluation errors
(integer overflow, `% 0`, `round` digits out of 0..15) throw
`EvaluationException` deterministically.

Implementation decisions not pinned by the contract:

- Number-to-text canonicalization uses .NET `"R"` invariant formatting
  (shortest round-trip; `NaN`, `Infinity`, `-Infinity` for non-finite).
- `round` accepts digits 0..15 only; outside that range is an evaluation error.
- `len` counts Unicode code points (per spec), not UTF-16 units.
- The type-check environment is scalar-only; `Any`- and Table-typed bindings
  (spec section 1) are not supported yet.

Provenance: new for the BimOpenFlow rewrite (2026-08-31); no prior source repo.
