"""Flag the Plato patterns that make a STEP mesher law throw, or say nothing, instead of failing.

    python -I sandbox/step-brep-mesh/tools/law_lint.py                      # the library and every staging folder
    python -I sandbox/step-brep-mesh/tools/law_lint.py --staging sandbox/step-mesh-staging/v1-faces
    python -I sandbox/step-brep-mesh/tools/law_lint.py --all                # also the findings the allowlist accepts

Two checks (TKT-440, reliability report docs/plans/step-mesher-reliability-2026-10-22.md, class H):

- unguarded: `&&` and `||` evaluate both operands in Plato (SPEC-DSL.md), so `a.Count == b.Count && a[0] == b[0]`
  reads a[0] even when the counts differ. In a law the throw is reported as an error, not a fail (v1-gate:
  SameUvPoints); in the library it is a crash on real files (v1-faces F3: IsBandPair's chain was one cause of
  TKT-411's 30 thrown corpus faces). Flagged: a statement whose `&&` or `||` operand tests a count, a range or a
  validity predicate, while a later operand indexes (`x[...]`, `.At(`). Guard with `? :` instead.
- staged comparison: a staged law whose body calls both a staged function and the library function whose name
  it extends (`EdgeDomainV1` and `EdgeDomain`). After the merge rewires the library function to the staged body,
  the law compares a function with itself and says nothing (F-59, F-56, v1-edges E3, v1-faces F1).

A finding is accepted by a line `<check> <relative path> <first identifier of the statement>` in law-lint-allow.txt
beside this script. Exits 1 on a finding not accepted.
"""
import argparse
import glob
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LIBRARY = os.path.normpath(os.path.join(HERE, ".."))
STAGING = os.path.normpath(os.path.join(LIBRARY, "..", "step-mesh-staging"))
ALLOW = os.path.join(HERE, "law-lint-allow.txt")

GUARD = re.compile(r"\.Count\s*(?:==|!=|>=|<=|>|<)|(?:==|!=|>=|<=|>|<)\s*[\w.]+\.Count|IsValidIndex|InRange|"
                   r"HasElement|IsWellFormed|CanEvaluate")
# An element read: the array expression and its subscript.
INDEX = re.compile(r"([\w.]+)\[([^\[\]]+)\]")
# A lambda over an array's index range binds its parameter to that array: xs.Count.Range.All(i => ...).
RANGE_LAMBDA = re.compile(r"([\w.]+)\.Count\.Range\.\w+\(\s*(\w+)\s*=>")
DECLARATION = re.compile(r"^\s+(\w+)\s*(?:<[^<>]*>)?\s*\(")
LAW = re.compile(r"^\s+(Law_\w+)\s*\(")
CALL = re.compile(r"\b([A-Z]\w*)\s*\(")
STAGED_SUFFIX = re.compile(r"^[A-Z0-9]\w*$")


def statements(path):
    """(line number, text) of each statement in a .plato file: text up to a `;` or a `{`, comments removed."""
    out, start, buffer = [], None, []
    with open(path, encoding="utf-8", errors="replace") as f:
        for number, line in enumerate(f, 1):
            code = line.split("//", 1)[0]
            for piece in re.split(r"(?<=[;{}])", code):
                if piece.strip() and start is None:
                    start = number
                buffer.append(piece)
                if piece.rstrip().endswith((";", "{", "}")):
                    text = " ".join(buffer).strip()
                    if text:
                        out.append((start, text))
                    start, buffer = None, []
    return out


def top_level_operands(text):
    """The operands of the top-level && and || of an expression (parentheses and brackets respected)."""
    depth, current, operands, i = 0, [], [], 0
    while i < len(text):
        ch = text[i]
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        if depth <= 0 and text.startswith(("&&", "||"), i):
            operands.append("".join(current))
            current, i = [], i + 2
            continue
        current.append(ch)
        i += 1
    operands.append("".join(current))
    return operands


def chains(text):
    """Every &&/|| chain in a statement: the statement itself and each parenthesised group, as operand lists."""
    found = [top_level_operands(text)]
    stack = []
    for i, ch in enumerate(text):
        if ch == "(":
            stack.append(i)
        elif ch == ")" and stack:
            found.append(top_level_operands(text[stack.pop() + 1:i]))
    return [ops for ops in found if len(ops) > 1]


def unsafe_reads(operand, guard):
    """The element reads of an operand that a guard before it in a non-short-circuit chain does not protect:
    a literal subscript (winding[1]), a lambda variable bound to another array's range (b[i] in
    a.Count.Range.All(i => b[i])), or a variable the guard itself tests (k < xs.Count && xs[k]). A read after a
    `?` in the operand is taken as guarded there."""
    bound = {var: array for array, var in RANGE_LAMBDA.findall(operand)}
    guard_names = set(re.findall(r"\w+", guard))
    reads = []
    for match in INDEX.finditer(operand):
        if "?" in operand[:match.start()]:
            continue
        array, subscript = match.group(1), match.group(2).strip()
        if re.fullmatch(r"\d+", subscript):
            reads.append(match.group(0))
        elif subscript in bound:
            if bound[subscript] != array:
                reads.append(match.group(0))
        elif re.fullmatch(r"\w+", subscript) and subscript in guard_names:
            reads.append(match.group(0))
    return reads


def unguarded(path):
    for number, text in statements(path):
        if "&&" not in text and "||" not in text:
            continue
        for ops in chains(text):
            # A guard followed by `?` in its own operand is a conditional, which does short-circuit.
            guards = [k for k, op in enumerate(ops) if GUARD.search(op) and "?" not in op[GUARD.search(op).end():]]
            reads = [r for g in guards[:1] for op in ops[g + 1:] for r in unsafe_reads(op, ops[g])]
            if reads:
                yield number, text, reads
                break


def declared(paths):
    names = set()
    for path in paths:
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                match = DECLARATION.match(line)
                if match:
                    names.add(match.group(1))
    return names


def staged_comparisons(path, library_names, staged_names):
    """Laws of a staged file that call a staged name and the library name it extends."""
    body, law, start, indent = [], None, 0, 0
    def judge():
        if law is None:
            return None
        calls = set(CALL.findall(" ".join(body)))
        pairs = sorted((old, new) for new in calls & staged_names for old in calls & library_names
                       if new != old and new.startswith(old) and STAGED_SUFFIX.match(new[len(old):]))
        return (start, law, pairs) if pairs else None
    with open(path, encoding="utf-8", errors="replace") as f:
        for number, line in enumerate(f, 1):
            match = LAW.match(line)
            declaration = DECLARATION.match(line)
            # A law's body ends at the next declaration at its own indentation: a helper after the law is not part
            # of it (R2A's Law_V1Reliability_ClosedDirectionIsPeriodic was charged with the comparisons of the
            # helpers written below it).
            if law is not None and declaration and not match and len(line) - len(line.lstrip()) <= indent:
                found = judge()
                if found:
                    yield found
                law = None
            if match:
                found = judge()
                if found:
                    yield found
                law, start, body, indent = match.group(1), number, [], len(line) - len(line.lstrip())
            if law is not None:
                body.append(line.split("//", 1)[0])
    found = judge()
    if found:
        yield found


def first_identifier(text):
    match = re.search(r"\w+", text)
    return match.group(0) if match else ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--staging", action="append", help="staging folders to lint (default: every folder under "
                                                            "sandbox/step-mesh-staging)")
    parser.add_argument("--all", action="store_true", help="print accepted findings too")
    args = parser.parse_args()
    library_files = sorted(glob.glob(os.path.join(LIBRARY, "**", "*.plato"), recursive=True))
    staging_dirs = args.staging or sorted(d for d in glob.glob(os.path.join(STAGING, "*")) if os.path.isdir(d))
    staging_files = sorted(f for d in staging_dirs for f in glob.glob(os.path.join(d, "**", "*.plato"), recursive=True))
    allowed = set()
    if os.path.exists(ALLOW):
        with open(ALLOW, encoding="utf-8") as f:
            allowed = {tuple(line.split()[:3]) for line in f if line.strip() and not line.startswith("#")}

    findings = []
    root = os.path.normpath(os.path.join(LIBRARY, "..", ".."))
    for path in library_files + staging_files:
        rel = os.path.relpath(path, root).replace("\\", "/")
        for number, text, reads in unguarded(path):
            findings.append(("unguarded", rel, number, first_identifier(text),
                             "reads " + ", ".join(dict.fromkeys(reads)) + " whatever the guard before it says"))
    library_names = declared(library_files)
    for d in staging_dirs:
        files = sorted(glob.glob(os.path.join(d, "**", "*.plato"), recursive=True))
        staged_names = declared(files) - library_names
        for path in files:
            rel = os.path.relpath(path, root).replace("\\", "/")
            for number, law, pairs in staged_comparisons(path, library_names, staged_names):
                findings.append(("staged-comparison", rel, number, law,
                                 "compares " + ", ".join(f"{new} with {old}" for old, new in pairs)
                                 + "; after the merge rewires the library name, this says nothing"))
    new = [f for f in findings if (f[0], f[1], f[3]) not in allowed]
    for check, rel, number, name, text in (findings if args.all else new):
        print(f"{check:<18} {rel}:{number}  {name}  {text}")
    print(f"{len(findings)} finding(s), {len(findings) - len(new)} accepted, {len(new)} new "
          f"({sum(f[0] == 'unguarded' for f in new)} unguarded, {sum(f[0] == 'staged-comparison' for f in new)} "
          f"staged comparisons); {len(library_files)} library and {len(staging_files)} staged files")
    return 1 if new else 0


if __name__ == "__main__":
    sys.exit(main())
