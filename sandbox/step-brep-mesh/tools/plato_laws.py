"""Call the plato-navigation server's plato_laws tool from a shell.

    python -I sandbox/step-brep-mesh/tools/plato_laws.py "Law_A,Law_B" [--types all] [--report FILE] [--baseline FILE]
    python -I sandbox/step-brep-mesh/tools/plato_laws.py none        # type check only
    python -I sandbox/step-brep-mesh/tools/plato_laws.py "Law_X" --staging sandbox/step-mesh-staging/poles

A session reads its MCP tool list when it starts, so agents that were running before the server
on 127.0.0.1:8768 gained plato_laws (Plato 38f2031a, studio b7598e75) cannot call it as a tool.
This script speaks the server's HTTP transport directly: initialize, then one tools/call. The
server keeps its compilation between calls, so a run after a one-body edit takes about 5 s
instead of the 25 s a cold `plato run` compile takes (0.7 s with no edit, 12 s for the first
call after the server starts; 2026-10-18). Prints type errors, one line per law and a summary;
exits 1 on a type error or a law that fails or errors, 2 when the server's answer is not
understood.
"""
import argparse
import json
import os
import sys
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


def post(body, session=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    if session:
        headers["Mcp-Session-Id"] = session
    request = urllib.request.Request(URL, data=json.dumps(body).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=1800) as response:
        text = response.read().decode("utf-8", "replace")
        session = response.headers.get("Mcp-Session-Id", session)
    # The transport may answer as JSON or as server-sent events whose data lines hold the JSON.
    lines = [line[5:].strip() for line in text.splitlines() if line.startswith("data:")]
    payload = json.loads(lines[-1]) if lines else (json.loads(text) if text.strip() else None)
    return payload, session


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("filter", help="comma list of law or class names, or 'none' for the type check only")
    parser.add_argument("--types", choices=["changed", "all"], default=None)
    parser.add_argument("--report")
    parser.add_argument("--baseline")
    parser.add_argument("--staging", action="append", default=[],
                        help="a track's staging folder, compiled after the library (repeatable)")
    parser.add_argument("--profile", default=PROFILE,
                        help=f"Number profile; default {PROFILE}")
    args = parser.parse_args()

    _, session = post({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
        "protocolVersion": "2025-03-26", "capabilities": {},
        "clientInfo": {"name": "plato_laws.py", "version": "1"}}})
    post({"jsonrpc": "2.0", "method": "notifications/initialized"}, session)

    arguments = {"filter": args.filter, "profile": args.profile}
    if args.staging:
        arguments["folders"] = ",".join(LIBRARY + [os.path.abspath(s) for s in args.staging])
    for key in ("types", "report", "baseline"):
        if getattr(args, key):
            arguments[key] = getattr(args, key)
    result, _ = post({"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                      "params": {"name": "plato_laws", "arguments": arguments}}, session)
    if result is None or "error" in result:
        print(json.dumps(result, indent=1))
        return 2
    text = "\n".join(part.get("text", "") for part in result["result"].get("content", []))
    try:
        data = json.loads(text).get("data", {})
    except ValueError:
        print(text)
        return 2
    for error in data.get("typeErrors", []):
        print(error if isinstance(error, str) else json.dumps(error))
    for line in data.get("results", []):
        print(line)
    timings = data.get("timings", {})
    print(f"{data.get('laws', 0)} laws: {json.dumps(data.get('counts', {}))}; "
          f"{data.get('typeErrorCount', 0)} type errors; recompiled {timings.get('recompiled')}, "
          f"compile {timings.get('compileMs')} ms, laws {timings.get('lawsMs')} ms")
    counts = data.get("counts", {})
    if args.filter != "none" and data.get("laws", 0) == 0:
        # The server answers "0 laws, 0 type errors" when a file fails to parse (TKT-337), so an
        # empty run is never a pass: check the parse with the pinned CLI.
        print("no laws matched: a misspelled filter, or a file that does not parse. "
              "Run the pinned CLI with the same --filter to see a parse error.")
        return 2
    failed = result["result"].get("isError") or data.get("typeErrorCount", 0) > 0 \
        or counts.get("fail", 0) > 0 or counts.get("error", 0) > 0
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
