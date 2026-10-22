"""Tests for the STEP mesher's tools that need no server or build: law_lint.py and plato_laws.py's filter handling.

    python -I sandbox/step-brep-mesh/tools/test_tools.py

Exits 1 on a failing test, printing it; 0 with a count otherwise.
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import law_lint  # noqa: E402
import plato_laws  # noqa: E402

FAILURES = []


def check(name, condition):
    if not condition:
        FAILURES.append(name)


def staged_findings(text, library, staged):
    with tempfile.NamedTemporaryFile("w", suffix=".laws.plato", delete=False, encoding="utf-8") as f:
        f.write(text)
    try:
        return list(law_lint.staged_comparisons(f.name, library, staged))
    finally:
        os.unlink(f.name)


# law_lint: a helper written after a law is not part of the law's body (the false staged comparison the merge agent
# found on R2A's Law_V1Reliability_ClosedDirectionIsPeriodic, whose following helpers compare EvalWrapped with the
# record-level Eval on purpose).
HELPER_AFTER_LAW = """library L
{
    Law_A(_: Integer): Boolean
        => Periodic(1);

    Helper(g: GeometrySet): Boolean
        => EvalWrapped(g) == Eval(g);
}
"""
check("law_lint: a helper after a law is not the law's body",
      staged_findings(HELPER_AFTER_LAW, {"Eval", "Periodic"}, {"EvalWrapped"}) == [])

# law_lint: a law that itself calls a staged name and the library name it extends is still reported.
LAW_COMPARES = """library L
{
    Law_B(_: Integer): Boolean
        => EvalWrapped(g) == Eval(g);
}
"""
found = staged_findings(LAW_COMPARES, {"Eval"}, {"EvalWrapped"})
check("law_lint: a law comparing EvalWrapped with Eval is reported",
      len(found) == 1 and found[0][1] == "Law_B" and found[0][2] == [("Eval", "EvalWrapped")])

# law_lint: a law with a block body (braces) keeps its whole body.
BLOCK_BODY = """library L
{
    Law_C(_: Integer): Boolean
    {
        var g = Witness(1);
        return EvalWrapped(g) == Eval(g);
    }
}
"""
check("law_lint: a law's block body is its body",
      len(staged_findings(BLOCK_BODY, {"Eval", "Witness"}, {"EvalWrapped"})) == 1)

# plato_laws: a filter entry that matches no result is reported, even beside entries that match (the server drops
# it silently: perf-refine-edges' BsplinePipelineLaws.Law_EdgeLaws).
results = [("pass", "BisectionCachedLaws.Law_SagittaGivenAgrees", ""), ("pass", "BrepCheckingLaws.Law_CorpusEntryExercisesAFeature", "")]
check("plato_laws: an unmatched qualified name beside a block name is reported",
      plato_laws.unmatched("BisectionCachedLaws,BsplinePipelineLaws.Law_EdgeLaws", results) == ["BsplinePipelineLaws.Law_EdgeLaws"])
check("plato_laws: matched entries are not reported, ignoring case and signatures",
      plato_laws.unmatched("bisectioncachedlaws,BrepCheckingLaws.Law_CorpusEntryExercisesAFeature(Integer)", results) == [])

# plato_laws: a law qualified with a block that does not declare it is rewritten to the block that does.
with tempfile.TemporaryDirectory() as folder:
    with open(os.path.join(folder, "x.laws.plato"), "w", encoding="utf-8") as f:
        f.write("library RightLaws\n{\n    Law_X(_: Integer): Boolean\n        => true;\n}\n")
    check("plato_laws: a law under the wrong block is qualified with its own",
          plato_laws.qualified("WrongLaws.Law_X,OtherLaws", [folder]) == "RightLaws.Law_X,OtherLaws")
    check("plato_laws: a law under its own block is kept",
          plato_laws.qualified("RightLaws.Law_X,OtherLaws", [folder]) == "RightLaws.Law_X,OtherLaws")
    check("plato_laws: a bare law is qualified",
          plato_laws.qualified("Law_X", [folder]) == "RightLaws.Law_X")

for name in FAILURES:
    print("FAIL", name)
print(f"{9 - len(FAILURES)} of 9 passed")
sys.exit(1 if FAILURES else 0)
