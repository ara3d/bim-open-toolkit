"""Fail when the generated C# of the STEP mesher holds a throwing stub the library did not ask for.

    python -I sandbox/step-brep-mesh/tools/check_generated.py deps/bim-open-data/src/data/Ara3D.StepBrep/Generated
    python -I sandbox/step-brep-mesh/tools/check_generated.py <generated folder> --log <regen log>
    python -I sandbox/step-brep-mesh/tools/check_generated.py <generated folder> --write-baseline

The Plato C# writer emits a body it cannot compile as `throw new System.NotImplementedException("plato: ...")`
and says so only in a DEGRADED line of its log. TKT-410: `SagittaByHullBoundGiven` was such a stub, the
regeneration printed one DEGRADED line, and the corpus lost 22,410 faces before anyone read it. Two kinds of
stub exist:

- degraded: a function the library gives a body that the writer dropped ("no ground TIR", "not
  monomorphized", anything but "declared without a body"). Always a failure.
- bodiless: a function the library declares without a body (a host obligation such as `FlatRecord`). Allowed
  only when its name is in the baseline file beside this script (generated-stubs.txt); a new one is a
  failure, because a mesh path that reaches it throws at run time (TKT-348: the bodiless `BSplinePoint`
  cost 72 of 88 corpus files).

With --log, any DEGRADED line in the regeneration log is a failure too. Exits 0 when clean, 1 otherwise.
"""
import argparse
import os
import re
import sys

MARK = 'NotImplementedException("plato: '
# The name before the parameter list that ends just before the throw; the parameter list may hold generic
# arguments, so it is matched from the last "(" before "=> throw".
STUB = re.compile(r'(\w+)(?:<[^<>()]*>)?\(([^()]|\([^()]*\))*\)\s*=>\s*throw new System\.NotImplementedException\("plato: ([^"]*)"\)')
BODILESS = "is declared without a body"
BASELINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generated-stubs.txt")


def stubs(folder):
    """(kind, name, file, line, message) for every throwing stub under the folder's .cs files."""
    found = []
    for root, _, files in os.walk(folder):
        for name in sorted(files):
            if not name.endswith(".cs"):
                continue
            path = os.path.join(root, name)
            with open(path, encoding="utf-8", errors="replace") as f:
                for number, line in enumerate(f, 1):
                    if MARK not in line:
                        continue
                    for match in STUB.finditer(line):
                        kind = "bodiless" if BODILESS in match.group(3) else "degraded"
                        found.append((kind, match.group(1), os.path.relpath(path, folder), number, match.group(3)))
    return found


def read_baseline(path):
    if not os.path.exists(path):
        return set()
    with open(path, encoding="utf-8") as f:
        return {line.strip() for line in f if line.strip() and not line.startswith("#")}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("generated", help="the generated C# folder, e.g. deps/bim-open-data/src/data/Ara3D.StepBrep/Generated")
    parser.add_argument("--log", help="the regeneration's log; a DEGRADED line in it fails the check")
    parser.add_argument("--baseline", default=BASELINE, help=f"allowed bodiless names, one per line; default {BASELINE}")
    parser.add_argument("--write-baseline", action="store_true",
                        help="write the bodiless names found to the baseline file and exit (after a deliberate change)")
    args = parser.parse_args()

    found = stubs(args.generated)
    bodiless = sorted({name for kind, name, *_ in found if kind == "bodiless"})
    if args.write_baseline:
        with open(args.baseline, "w", encoding="utf-8", newline="\n") as f:
            f.write("# Functions the STEP mesher library declares without a body (host obligations), as the C# writer\n"
                    "# emits them. check_generated.py fails on a bodiless stub not listed here. Regenerate with\n"
                    "# --write-baseline only after deciding the new obligation is meant.\n")
            f.writelines(name + "\n" for name in bodiless)
        print(f"wrote {len(bodiless)} names to {args.baseline}")
        return 0

    allowed = read_baseline(args.baseline)
    failures = []
    for kind, name, path, number, message in found:
        if kind == "degraded":
            failures.append(f"degraded  {name}  {path}:{number}  {message}")
        elif name not in allowed:
            failures.append(f"new bodiless  {name}  {path}:{number}  (not in {os.path.basename(args.baseline)})")
    if args.log:
        with open(args.log, encoding="utf-8", errors="replace") as f:
            failures += [f"log  {line.strip()}" for line in f if re.search(r"DEGRADED|degraded:", line)]
    for line in failures:
        print(line)
    gone = sorted(allowed - set(bodiless))
    print(f"{len(found)} stubs: {sum(k == 'degraded' for k, *_ in found)} degraded, {len(bodiless)} bodiless "
          f"({len(gone)} listed names no longer stubs{': ' + ', '.join(gone) if gone else ''}); "
          f"{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
