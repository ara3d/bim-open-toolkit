"""Call the plato-navigation server's plato_laws tool from a shell.

    python -I sandbox/step-brep-mesh/tools/plato_laws.py "Law_A,Law_B" [--types all] [--report FILE] [--baseline FILE]
    python -I sandbox/step-brep-mesh/tools/plato_laws.py none        # type check only
    python -I sandbox/step-brep-mesh/tools/plato_laws.py "Law_X" --staging sandbox/step-mesh-staging/poles
    python -I sandbox/step-brep-mesh/tools/plato_laws.py "Law_X" --budget 20 --timeout 7200   # a long sweep
    python -I sandbox/step-brep-mesh/tools/plato_laws.py "Block" --rerun-budget 120 --coverage cov.tsv

A session reads its MCP tool list when it starts, so agents that were running before the server
on 127.0.0.1:8768 gained plato_laws (Plato 38f2031a, studio b7598e75) cannot call it as a tool.
This script speaks the server's HTTP transport directly: initialize, then one tools/call. The
server keeps its compilation between calls, so a run after a one-body edit takes about 5 s
instead of the 25 s a cold `plato run` compile takes (0.7 s with no edit, 12 s for the first
call after the server starts; 2026-10-18). Prints type errors, one line per law and a summary;
exits 1 on a type error or a law that fails, errors or is skipped, 2 when the server's answer is
not understood, 3 when the server is busy: another request held the program past the wait
(--wait, the server's --law-busy-wait otherwise, 60 s), or no answer came within --timeout. Then it
prints the server's error, which names the request holding the program and its step, and what each
program on the server is running (plato_law_status), and the caller can retry or use plato run
(TKT-479).

A skipped law is a failure unless --allow-skipped: the runner skips a law when it has no values
for one of its parameter types, so the law checked nothing (TKT-434; 14 laws of
verdicts-cpu64.tsv, among them the eight B-spline surface validity laws, while the corpus holds
15,580 B-spline faces). A budget error says the law was slow on a loaded machine, not whether it
holds: with --rerun-budget S each budget error is run again alone with a budget of S seconds and
the settled verdict replaces it (TKT-401 and TKT-399 were failures recorded as budget errors for
days). --coverage FILE writes one row per law: its verdict, the cases run, how the cases were made
(exhaustive, sampled, or one case for an input-free law), and the detail, so a law that passes on
one case or on 25 generated values can be told from one that passes on every witness. A law whose
Premise_<Law> companion held on no case is reported "vacuous" (Plato 00610b70, TKT-437) and fails the
run like a fail; the coverage table gives the premise-held count of every pass with a companion.
--backend differential (Plato ec51f061, TKT-438) runs every law and witness in both engines; a
disagreement is the verdict "differs", with the case and both answers, and fails the run too.

Before the laws, the program the C# regeneration compiles (shipped-program.txt: the stdlib tiers and layers 00 to
08 alone) is type-checked on its own, and a type error there fails the run: the whole program the laws need can
hide a call from layer 00 to 08 into layers 09 to 11 (the V1G-1 merge, 7a59273d). --no-shipped-check skips it.

The server does not always match a bare law name, so the script rewrites each bare `Law_X`, and
`Law_X(signature)` for an overload, as `Block.Law_X` for every block of the compiled folders that
declares it; a path in MSYS form (/c/...) is read as C:/...; and an empty run is asked once more
before it is reported, since the server can answer 0 laws once right after an edit (TKT-427).
"""
import argparse
import glob
import json
import os
import re
import sys
import urllib.error
import urllib.request

URL = "http://127.0.0.1:8768/mcp"
# 64-bit Number since TKT-315 merged (Plato 78be1798, 2026-10-19); gpu32 stays available per call.
PROFILE = "cpu64"
# The server's own law folders, in order; a track's staging folder is compiled after them.
LIBRARY = [
    "C:/Users/cdigg/git/plato/stdlib/foundation",
    "C:/Users/cdigg/git/plato/stdlib/geometry",
    "C:/Users/cdigg/git/plato/stdlib/graphics",
    "C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh",
]


TIMEOUT = 1800

BLOCK = re.compile(r"^\s*(?:library|laws)\s+(\w+)")
LAW = re.compile(r"^\s+(Law_\w+)\s*\([^()]*\)\s*:")
# One result line of the server: LawResult.ToString() in Plato's LawRunner.cs.
RESULT = re.compile(r"^(pass|fail|error|obligation|skipped|vacuous|differs)\s+(\S+)\s*(.*)$")
CASES = re.compile(r"\((\d+) cases(, exhaustive)?(?:, premise held on (\d+))?\)")
BUDGET = re.compile(r"over the [\d.]+s budget|still running after|time budget exceeded")
VERDICTS = ("pass", "fail", "error", "obligation", "skipped", "vacuous", "differs")


def windows_path(path):
    """C:/x for the MSYS form /c/x, which os.path.abspath would read as C:/c/x; any other path unchanged."""
    match = re.match(r"^/([A-Za-z])(/.*)?$", path)
    return f"{match.group(1).upper()}:{match.group(2) or '/'}" if match else path


def law_blocks(folders):
    """Law name -> the blocks (library or laws) declaring it, over the .plato files under the folders."""
    blocks = {}
    for folder in folders:
        for path in glob.glob(os.path.join(folder, "**", "*.plato"), recursive=True):
            block = None
            with open(path, encoding="utf-8", errors="replace") as f:
                for line in f:
                    header = BLOCK.match(line)
                    if header:
                        block = header.group(1)
                        continue
                    law = LAW.match(line)
                    if law and block:
                        blocks.setdefault(law.group(1), []).append(block)
    return blocks


def qualified(filter_text, folders):
    """The filter with each bare law name, or law name with a signature, rewritten as Block.Law for every
    block declaring it; block names, Block.Law names and names declared nowhere are kept as given."""
    # Split on the commas outside parentheses: a signature holds commas of its own.
    names = [re.sub(r"\(.*$", "", t).strip() for t in re.split(r",(?![^()]*\))", filter_text) if t.strip()]
    if not any(n.rpartition(".")[2].startswith("Law_") for n in names):
        return filter_text
    blocks = law_blocks(folders)
    out = []
    for name in names:
        block, _, law = name.rpartition(".")
        known = law.startswith("Law_") and law in blocks
        if known and block and block not in blocks[law]:
            # Qualified with a block that does not declare it (renamed or moved at a merge), it would match no law
            # on the server; qualify it with the blocks that do.
            print(f"note: {name}: {law} is declared in {', '.join(blocks[law])}, not in {block}")
        moved = known and (not block or block not in blocks[law])
        out.extend([f"{b}.{law}" for b in blocks[law]] if moved else [name])
    return ",".join(dict.fromkeys(out))


def filter_entries(filter_text):
    """The entries of a filter, split on the commas outside parentheses, each without its signature."""
    return [re.sub(r"\(.*$", "", t).strip() for t in re.split(r",(?![^()]*\))", filter_text) if t.strip()]


def unmatched(filter_text, results):
    """The filter entries that no result's law name contains (the server's rule, ignoring case). With other entries
    matching, the server drops such an entry without a word, so the script reports it."""
    names = [r[1].lower() for r in results if r[1]]
    return [e for e in filter_entries(filter_text) if not any(e.lower() in n for n in names)]


def post(body, session=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    if session:
        headers["Mcp-Session-Id"] = session
    request = urllib.request.Request(URL, data=json.dumps(body).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        text = response.read().decode("utf-8", "replace")
        session = response.headers.get("Mcp-Session-Id", session)
    # The transport may answer as JSON or as server-sent events whose data lines hold the JSON.
    lines = [line[5:].strip() for line in text.splitlines() if line.startswith("data:")]
    payload = json.loads(lines[-1]) if lines else (json.loads(text) if text.strip() else None)
    return payload, session


class ServerBusy(Exception):
    """The server answered busy (another request holds the program past the wait), or did not answer within
    --timeout; main prints who holds what and exits 3 (TKT-479)."""


def print_status():
    """What every program on the server is running, from plato_law_status (Plato 5776a36e, studio 6ea54603), which
    answers at once even mid-run; a line saying so when the server is too old to have the tool or does not answer."""
    try:
        data = call({}, tool="plato_law_status", timeout=30)
    except (OSError, ValueError) as e:
        print(f"plato_law_status did not answer: {e}")
        return
    if not data or "programs" not in data:
        print("plato_law_status is not available on this server (built before Plato 5776a36e)")
        return
    for p in data["programs"]:
        running = f"{p['running']}; step {p['step']}, for {p['runningSeconds']:.0f} s" if p.get("running") else "idle"
        print(f"server program: {running}  [{p['program']}]")
    print(f"server: {data.get('workingSetMb')} MB working set, {data.get('cpuSeconds')} CPU s, "
          f"{data.get('threads')} threads, {len(data['programs'])} of {data.get('maxPrograms')} programs kept")


def call(arguments, tool="plato_laws", timeout=None):
    """One call of a tool on a fresh session: the server's data object, or None after printing an answer
    that is not understood."""
    global TIMEOUT
    saved = TIMEOUT
    if timeout is not None:
        TIMEOUT = timeout
    try:
        _, session = post({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2025-03-26", "capabilities": {},
            "clientInfo": {"name": "plato_laws.py", "version": "1"}}})
        post({"jsonrpc": "2.0", "method": "notifications/initialized"}, session)
        result, _ = post({"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                          "params": {"name": tool, "arguments": arguments}}, session)
    finally:
        TIMEOUT = saved
    if result is None or "error" in result:
        print(json.dumps(result, indent=1))
        return None
    text = "\n".join(part.get("text", "") for part in result["result"].get("content", []))
    try:
        data = json.loads(text).get("data", {})
    except ValueError:
        print(text)
        return None
    data["isError"] = result["result"].get("isError")
    return data


def run(arguments):
    """call, asked once more when it matched no law (TKT-427: the server can answer 0 laws once right
    after an edit). A busy answer, or no answer within --timeout, prints the server's error and what each of its
    programs is running, then raises ServerBusy: the request holding the program is named, not just timed out."""
    def once():
        try:
            data = call(arguments)
        except (TimeoutError, urllib.error.URLError) as e:
            if isinstance(e, urllib.error.URLError) and not isinstance(e.reason, TimeoutError):
                raise
            print(f"no answer within {TIMEOUT:g} s; the server keeps running the request")
            print_status()
            raise ServerBusy() from e
        if data is not None and data.get("busy"):
            for error in data.get("errors", []):
                print(error)
            print_status()
            raise ServerBusy()
        return data
    data = once()
    if data is not None and arguments["filter"] != "none" and data.get("laws", 0) == 0:
        data = once()
    return data


def parse_result(line):
    """(verdict, law, detail) of one result line, or (None, None, line) for a line of another kind."""
    match = RESULT.match(line)
    return (match.group(1), match.group(2), match.group(3).strip()) if match else (None, None, line)


def is_budget_error(result):
    return result[0] == "error" and bool(BUDGET.search(result[2]))


def settled(result, arguments, budget):
    """A budget error run again alone with a larger budget, so its verdict is the law's, not the load's."""
    verdict, law, detail = result
    data = run(dict(arguments, filter=law, budget=budget))
    again = next((r for r in map(parse_result, (data or {}).get("results", [])) if r[1] == law), None)
    if again is None:
        return verdict, law, f"{detail}  [rerun alone at {budget:g}s gave no verdict]"
    return again[0], law, f"{again[2]}  [settled alone at {budget:g}s; first run: {detail}]"


SHIPPED = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shipped-program.txt")


def shipped_program(library_root):
    """The folders and excluded file names of the program the regeneration compiles (shipped-program.txt), with
    the library's layers under library_root: what Ara3D.StepBrep is made from, without layers 09 to 11 or staging."""
    stdlib = os.path.dirname(LIBRARY[0])
    tiers, globs, layers = [], [], []
    with open(SHIPPED, encoding="utf-8") as f:
        for line in f:
            words = line.split("#", 1)[0].split()
            if words and words[0] == "stdlib":
                tiers.append(f"{stdlib}/{words[1]}")
            elif words and words[0] == "exclude":
                globs += words[1:]
            elif words and words[0] == "layer":
                layers.append(f"{library_root}/{words[1]}")
    excluded = sorted({os.path.basename(p) for tier in tiers for g in globs for p in glob.glob(os.path.join(tier, g))})
    return tiers + layers, excluded


def compile_errors(data):
    """The compilation's own errors: parse and symbol-resolution failures, which the server reports as ok false with
    an errors list and 0 type errors (TKT-337, F-60). Read only typeErrors, a run that did not compile looks clean:
    that is how the V1G-1 merge's 12 unresolved symbols passed its check."""
    # Only a listed error counts: the server also answers ok false when a law fails.
    return [e if isinstance(e, str) else json.dumps(e) for e in data.get("errors", [])]


def check_shipped(library_root, profile):
    """Type-check the shipped program alone. The whole program a law run compiles can hide a call from layers 00 to
    08 into 09 to 11 (the V1G-1 merge, 7a59273d: 12 symbol errors the regeneration hit and the server did not).
    Returns the number of type errors, or None when the server's answer is not understood."""
    folders, excluded = shipped_program(library_root)
    data = call({"filter": "none", "profile": profile, "folders": ",".join(folders), "recursive": False,
                 "exclude": ",".join(excluded), "types": "all"})
    if data is None:
        return None
    errors = compile_errors(data) + data.get("typeErrors", [])
    count = len(compile_errors(data)) + data.get("typeErrorCount", len(data.get("typeErrors", [])))
    for error in errors[:20]:
        print("shipped program: " + (error if isinstance(error, str) else json.dumps(error)))
    print(f"shipped program (shipped-program.txt: {len(folders)} folders, {len(excluded)} stdlib files excluded): "
          f"{count} type errors")
    return count


def coverage_row(verdict, law, detail):
    """Law, verdict, cases, how the cases were made, the cases where its premise held (blank when the law has no
    Premise_ companion; Plato 00610b70, TKT-437), detail: one row of the --coverage table."""
    cases = CASES.search(detail)
    if verdict == "pass" and cases:
        count = int(cases.group(1))
        mode = "exhaustive" if cases.group(2) else ("one case" if count == 1 else "sampled")
        return [law, verdict, str(count), mode, cases.group(3) or "", ""]
    return [law, verdict, "", "-", "", detail]


def main():
    global TIMEOUT
    parser = argparse.ArgumentParser()
    parser.add_argument("filter", help="comma list of law or class names, or 'none' for the type check only")
    parser.add_argument("--types", choices=["changed", "all"], default=None)
    parser.add_argument("--report")
    parser.add_argument("--baseline")
    parser.add_argument("--staging", action="append", default=[],
                        help="a track's staging folder, compiled after the library (repeatable)")
    parser.add_argument("--profile", default=PROFILE,
                        help=f"Number profile; default {PROFILE}")
    parser.add_argument("--library",
                        help="a folder to compile in place of sandbox/step-brep-mesh, for example a `git archive` "
                             "copy of a committed state, to tell a regression from a slower day")
    parser.add_argument("--budget", type=float,
                        help="seconds one law may take before it is reported as an error (server default otherwise)")
    parser.add_argument("--backend", choices=["interpreter", "csharp", "differential"],
                        help="the server's law backend; differential runs every law and witness in the interpreter "
                             "and on compiled C# and reports each disagreement as differs (Plato ec51f061, TKT-438)")
    parser.add_argument("--allow-skipped", action="store_true",
                        help="do not count a skipped law (no values for a parameter type) as a failure")
    parser.add_argument("--rerun-budget", type=float, metavar="SECONDS",
                        help="run each budget error again alone with this budget and report the settled verdict")
    parser.add_argument("--coverage", metavar="FILE",
                        help="write a tab-separated table: law, verdict, cases, how the cases were made, detail")
    parser.add_argument("--no-shipped-check", action="store_true",
                        help="skip the type check of the shipped program (layers 00 to 08 alone, shipped-program.txt)")
    parser.add_argument("--wait", type=float, metavar="SECONDS",
                        help="seconds to wait for a program another request is running on before the server answers "
                             "busy (exit 3); the server's --law-busy-wait otherwise")
    parser.add_argument("--timeout", type=float, default=TIMEOUT,
                        help=f"seconds to wait for the server's answer; default {TIMEOUT}. The server keeps "
                             "running a request the client gave up on, so a full sweep needs a longer wait")
    args = parser.parse_args()
    TIMEOUT = args.timeout
    for key in ("library", "report", "baseline", "coverage"):
        if getattr(args, key):
            setattr(args, key, windows_path(getattr(args, key)))
    args.staging = [windows_path(s) for s in args.staging]

    library = LIBRARY[:-1] + [os.path.abspath(args.library).replace("\\", "/")] if args.library else LIBRARY
    folders = library + [os.path.abspath(s) for s in args.staging]
    arguments = {"filter": qualified(args.filter, folders) if args.filter != "none" else args.filter,
                 "profile": args.profile}
    if args.staging or args.library:
        arguments["folders"] = ",".join(folders)
    for key in ("types", "report", "baseline", "budget", "backend", "wait"):
        if getattr(args, key) is not None:
            arguments[key] = getattr(args, key)
    shipped_errors = 0 if args.no_shipped_check else check_shipped(library[-1], args.profile)
    if shipped_errors is None:
        return 2
    data = run(arguments)
    if data is None:
        return 2
    for error in compile_errors(data):
        print("compile: " + error)
    for error in data.get("typeErrors", []):
        print(error if isinstance(error, str) else json.dumps(error))
    results = [parse_result(line) for line in data.get("results", [])]
    if args.rerun_budget:
        results = [settled(r, arguments, args.rerun_budget) if is_budget_error(r) else r for r in results]
    for verdict, law, detail in results:
        print(f"{verdict:<10} {law}  {detail}" if verdict else detail)
    timings = data.get("timings", {})
    print(f"{data.get('laws', 0)} laws: {json.dumps(data.get('counts', {}))}; "
          f"{data.get('typeErrorCount', 0)} type errors; recompiled {timings.get('recompiled')}, "
          f"compile {timings.get('compileMs')} ms, laws {timings.get('lawsMs')} ms")
    laws = [r for r in results if r[0]]
    tally = {v: sum(r[0] == v for r in laws) for v in VERDICTS}
    rows = [coverage_row(*r) for r in laws]
    modes = {m: sum(row[3] == m for row in rows) for m in ("exhaustive", "sampled", "one case")}
    print(f"verdicts{' after reruns' if args.rerun_budget else ''}: {json.dumps(tally)}, "
          f"{sum(map(is_budget_error, laws))} of the errors over budget; passes by cases: {json.dumps(modes)}")
    if args.coverage:
        with open(args.coverage, "w", encoding="utf-8", newline="\n") as f:
            f.write("law\tverdict\tcases\tmode\tpremise_held\tdetail\n")
            f.writelines("\t".join(row) + "\n" for row in rows)
    if args.filter != "none" and data.get("laws", 0) == 0:
        # The server answers "0 laws, 0 type errors" when a file fails to parse (TKT-337), so an
        # empty run is never a pass: check the parse with the pinned CLI.
        print("no laws matched: a misspelled filter, or a file that does not parse. "
              "Run the pinned CLI with the same --filter to see a parse error.")
        return 2
    missing = unmatched(arguments["filter"], results) if args.filter != "none" and data.get("laws", 0) > 0 else []
    for entry in missing:
        print(f"filter entry {entry} matched no law: a failure")
    skipped = tally["skipped"] > 0 and not args.allow_skipped
    if skipped:
        print(f"{tally['skipped']} skipped law(s) checked nothing: a failure (--allow-skipped to accept)")
    # The server's own counts decide too, unless reruns settled its errors, so a result line this script
    # does not parse can never turn a failing run into a pass.
    counts = {} if args.rerun_budget else data.get("counts", {})
    failed = data.get("isError") or bool(compile_errors(data)) or data.get("typeErrorCount", 0) > 0 \
        or tally["fail"] > 0 or tally["error"] > 0 or tally["vacuous"] > 0 or tally["differs"] > 0 or skipped or missing \
        or counts.get("fail", 0) > 0 or counts.get("error", 0) > 0 or counts.get("vacuous", 0) > 0 or counts.get("differs", 0) > 0 \
        or shipped_errors > 0
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ServerBusy:
        sys.exit(3)
