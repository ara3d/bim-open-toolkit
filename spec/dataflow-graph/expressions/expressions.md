# DataFlow Graph Expression Language

**Part:** expressions | **Version:** 0.1.0 | **Status:** Draft

Defines the expression language used by Expression-kind parameters on
derive/filter/what-if nodes. The language is deliberately small and fully
specified: an expression is a pure, statically typed function of a named
environment (typically the columns of a table row) to one value.

The core operator and typing decisions here (the `&` concatenation operator,
the precedence table, numeric result kinds, full null propagation) are
frozen in the repository's `CONTRACTS.md`; this document is the normative
elaboration of them.

Normative words (MUST, MUST NOT, SHOULD, MAY) follow RFC 2119.

## 1. Values and types

The type lattice is the semantics part's value kinds — Boolean, Integer
(Int64), Number (IEEE double), Text, Table — plus `Any`, plus **null**.

- Integer widens to Number wherever a Number is expected; nothing else
  converts implicitly.
- `null` is a first-class expression value denoting an absent cell. It has
  no kind of its own: the `null` literal is assignable to every type, and a
  null result carries the expression's static type.
- Table values may be bound in the environment but no operator or builtin
  accepts a Table in v0.1; expressions compute over scalars.
- `Any`-typed names type-check everywhere they appear; kind mismatches
  surface as evaluation errors at runtime instead of static errors.

## 2. Lexical grammar

- **Whitespace** — space, tab, CR, LF between tokens; no significance.
  There are no comments in v0.1.
- **Keywords** — `and`, `or`, `not`, `true`, `false`, `null`. Lowercase,
  case-sensitive; not usable as bare identifiers.
- **Identifiers** — bare: `[A-Za-z_][A-Za-z0-9_]*`. Quoted:
  `[` ... `]` containing any characters, with `]]` escaping a literal `]`
  (e.g. `[Fire Rating]`, `[Weird]]Name]`). Bare and quoted forms naming the
  same characters are the same identifier. Identifiers are case-sensitive.
- **Integer literal** — `[0-9]+`. Must fit in 0 … 2^63 − 1 (negation is the
  unary operator; the value −2^63 has no literal).
- **Number literal** — digits with a decimal point and/or exponent:
  `[0-9]+ "." [0-9]+ [exponent]` or `[0-9]+ exponent`, where exponent is
  `("e"|"E") ["+"|"-"] [0-9]+`. Any literal containing `.` or an exponent is
  a Number.
- **Text literal** — single- or double-quoted; escapes: `\\`, `\'`, `\"`,
  `\n`, `\t`. Any other backslash sequence is a lexical error.

## 3. Grammar (EBNF)

```ebnf
Expr      = CondExpr ;
CondExpr  = OrExpr [ "?" Expr ":" CondExpr ] ;          (* right-assoc *)
OrExpr    = AndExpr { "or" AndExpr } ;
AndExpr   = CmpExpr { "and" CmpExpr } ;
CmpExpr   = CatExpr { ("==" | "!=" | "<" | "<=" | ">" | ">=") CatExpr } ;
CatExpr   = AddExpr { "&" AddExpr } ;
AddExpr   = MulExpr { ("+" | "-") MulExpr } ;
MulExpr   = UnaryExpr { ("*" | "/" | "%") UnaryExpr } ;
UnaryExpr = ("-" | "not") UnaryExpr | Primary ;
Primary   = Literal | Identifier | Call | "(" Expr ")" ;
Call      = BareIdentifier "(" [ Expr { "," Expr } ] ")" ;
Literal   = IntegerLit | NumberLit | TextLit | "true" | "false" | "null" ;
```

Builtin names are not reserved: an identifier followed by `(` is a call
(and must name a builtin, §6); otherwise it is a name reference, so a
column may be called `len`.

## 4. Precedence and associativity

Highest to lowest; all binary operators are left-associative, the
conditional is right-associative:

| Level | Operators | Notes |
|---|---|---|
| 1 (highest) | unary `-`, `not` | prefix |
| 2 | `*` `/` `%` | |
| 3 | `+` `-` | |
| 4 | `&` | text concatenation |
| 5 | `==` `!=` `<` `<=` `>` `>=` | left-assoc; chains like `a < b < c` parse but then fail typing |
| 6 | `and` | |
| 7 | `or` | |
| 8 (lowest) | `?` `:` | right-assoc |

Consequences worth noting: `not` binds tighter than comparison, so
`not a == b` is `(not a) == b`; and `&` binds tighter than comparison, so
`a & b == c` is `(a & b) == c`.

## 5. Operator typing and semantics

Static typing first; runtime behavior second. A type error is a static
error: the expression is rejected before evaluation and the owning node is
misconfigured (unready per the semantics part), never a runtime crash.

**Null propagation (the one blanket rule):** every operator — arithmetic,
comparison, equality, `&`, `and`, `or`, `not`, unary `-`, and `?:` (on a
null condition) — yields null if any evaluated operand is null. There is no
three-valued logic and no special null equality; `coalesce` (§6) is the
tool for handling nulls. Consequence: `x == null` is always null, never
true — test for absence with `coalesce`, e.g. `coalesce(x, fallback)`.

- **Unary `-`** — Integer → Integer, Number → Number. Negating Int64
  minimum is an evaluation error (overflow).
- **`not`** — Boolean → Boolean.
- **`+` `-` `*`** — numeric operands; Integer if both operands are Integer,
  otherwise Number. Integer overflow is an evaluation error (checked, never
  wrapping). Number arithmetic is IEEE 754 (may produce infinities/NaN).
- **`/`** — numeric operands; the result is ALWAYS Number, including
  Integer ÷ Integer. Division by zero follows IEEE 754 (±Infinity, NaN for
  0/0).
- **`%`** — Integer % Integer → Integer only (no Number operands). Result
  has the sign of the dividend (C# semantics). `x % 0` is an evaluation
  error.
- **`&`** — text concatenation. Each operand may be any scalar (Boolean,
  Integer, Number, Text); result is Text. Non-Text operands convert to
  canonical invariant text: Boolean → `true`/`false`; Integer → decimal;
  Number → the .NET round-trip ("R") format, invariant culture (the same
  canonical double form as the format part §6), with non-finite values as
  `NaN`, `Infinity`, `-Infinity`.
- **`==` `!=`** — both operands numeric (mixed Integer/Number compares as
  Number), both Text, or both Boolean → Boolean. Text equality is ordinal
  (exact code points, case-sensitive). NaN is not equal to anything,
  including itself.
- **`<` `<=` `>` `>=`** — both operands numeric, or both Text → Boolean.
  Text ordering is ordinal by Unicode code point. Any comparison involving
  NaN is false.
- **`? :`** — condition Boolean; branch types must unify: identical, or
  Integer/Number unifying to Number (Any unifies with anything, to Any).
  Only the selected branch is evaluated; a null condition yields null
  without evaluating either branch.
- **`and` / `or`** — Boolean operands → Boolean. Not short-circuiting: both
  operands are evaluated, and a null on either side yields null (`false and
  null` is null, not false). This keeps the blanket null rule exact; use
  `?:` when a branch must not be evaluated. Evaluating both sides is safe
  because expressions are pure and evaluation errors are deterministic.

Evaluation errors (overflow, `% 0`, runtime kind mismatch on `Any`) poison
the owning node per the semantics part; they are deterministic.

## 6. Builtin functions

The complete, closed list for v0.1. Wrong argument count or argument types
are static errors. All builtins propagate null (any null argument → null
result) except `coalesce`.

| Signature | Result | Semantics |
|---|---|---|
| `abs(Integer)` → Integer; `abs(Number)` → Number | numeric | absolute value; `abs` of Int64 minimum is an evaluation error |
| `min(a, b, ...)`, `max(a, b, ...)` | Integer if all args Integer, else Number | 2+ numeric args; NaN arg yields NaN |
| `round(Number [, digits: Integer])` → Number | Number | round to `digits` decimal places (default 0), halves away from zero |
| `floor(Number)` → Number, `ceil(Number)` → Number | Number | toward −∞ / +∞ |
| `len(Text)` → Integer | Integer | count of Unicode code points |
| `lower(Text)` → Text, `upper(Text)` → Text | Text | Unicode simple case mapping, invariant culture |
| `contains(Text, Text)` → Boolean | Boolean | ordinal, case-sensitive substring test |
| `startswith(Text, Text)` → Boolean | Boolean | ordinal, case-sensitive |
| `endswith(Text, Text)` → Boolean | Boolean | ordinal, case-sensitive |
| `coalesce(a, b, ...)` → unified type | unified | 2+ args, types unify as in `?:`; returns the first non-null argument, evaluating left to right and stopping there; null if all are null |

`abs`, `min`, `max`, `round`, `floor`, `ceil` accept Integer where Number
is declared, via widening. There is no number→text or text→number
conversion function in v0.1 beyond `&`'s implicit formatting; parsing text
to numbers is a node's job, not an expression's.

## 7. The environment

The host node supplies the environment: a map from identifier to (type,
value). Typically each column of the input table is bound by column name,
with the column's kind as its type, evaluated once per row with that row's
cells (null for null cells). Referencing a name not in the environment is a
static error. The environment is immutable; expressions cannot define
names, and there is no assignment.

Determinism: an expression's value is a function of the expression text and
the environment values, nothing else. No clock, no randomness, no locale
(all Text operations are invariant/ordinal).

## 8. Conformance vectors

`conformance/` cases pair an expression and environment with the expected
static type and value, or an expected error class (`lexical`, `syntax`,
`type`). Value encoding in vectors: `{"kind": ..., "value": ...}` with JSON
null for null; Number values that are non-finite use the strings `"NaN"`,
`"Infinity"`, `"-Infinity"`.

## 9. Versioning

This part is versioned independently (semver). Adding a builtin or literal
form is minor; changing operator typing, precedence, null propagation, or
any builtin's semantics is major and invalidates run replay for graphs
using expressions.
