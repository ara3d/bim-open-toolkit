"""Summarize a corpus run of step-corpus-harness's laws mode (TKT-441) as markdown.

    step-corpus-harness all <corpus> <out> 300 --child laws
    python -I sandbox/step-brep-mesh/tools/laws_corpus_table.py <out> [--write report.md]

Reads every <file>.laws.csv and all.csv in the folder and prints, for each layer 7 check that does not pass
everywhere: the files where it fails or throws on the raw decoded model, the files where it fails on the prepared
model, and the files where it ran over its budget; then the checks over budget, the cost per file and in total.
A check failing on the raw model and not on the prepared one names a defect PrepareModel repairs; failing on both,
one it does not.
"""
import argparse
import csv
import glob
import os
import sys
from collections import defaultdict


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("folder")
    parser.add_argument("--write", help="write the markdown to this file as well")
    args = parser.parse_args()

    rows = defaultdict(lambda: defaultdict(list))  # law -> (stage, verdict) -> files
    where = {}
    files = []
    for path in sorted(glob.glob(os.path.join(args.folder, "*.laws.csv"))):
        name = os.path.basename(path)[:-len(".laws.csv")]
        files.append(name)
        with open(path, encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                verdict = r["verdict"]
                rows[r["law"]][(r["stage"], verdict)].append(name)
                if verdict in ("fail", "threw"):
                    where.setdefault((r["law"], r["stage"], name), r["where"] or r["exception"])

    status = {}
    total_ms = 0.0
    all_csv = os.path.join(args.folder, "all.csv")
    if os.path.exists(all_csv):
        with open(all_csv, encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                status[r["file"]] = (r["status"], float(r["ms"]))
                total_ms += float(r["ms"])

    out = []
    out.append(f"{len(files)} files with a laws table; {len(status)} files run; "
               f"{sum(1 for s in status.values() if s[0] != 'done')} not done "
               f"({', '.join(k for k, s in status.items() if s[0] != 'done') or 'none'}); "
               f"total {total_ms / 1000:.0f} s, median {sorted(s[1] for s in status.values())[len(status) // 2] / 1000:.0f} s a file"
               if status else f"{len(files)} files with a laws table")
    out.append("")
    out.append("| Check | Fails on raw | Fails on prepared | Over budget (raw, prepared) | First location |")
    out.append("|---|---|---|---|---|")
    failing = [law for law, v in rows.items() if any(fs for k, fs in v.items() if k[1] in ("fail", "threw"))]
    for law in sorted(failing, key=lambda l: -len(rows[l][("prepared", "fail")]) - len(rows[l][("raw", "fail")])):
        v = rows[law]
        raw = sorted(set(v[("raw", "fail")] + v[("raw", "threw")]))
        prepared = sorted(set(v[("prepared", "fail")] + v[("prepared", "threw")]))
        first = next((where[(law, s, n)] for s, fs in (("prepared", prepared), ("raw", raw)) for n in fs), "")
        def short(fs):
            return f"{len(fs)}: " + ", ".join(fs[:6]) + (" ..." if len(fs) > 6 else "") if fs else "0"
        out.append(f"| {law} | {short(raw)} | {short(prepared)} | {len(v[('raw', 'over budget')])}, "
                   f"{len(v[('prepared', 'over budget')])} | {first[:80]} |")
    out.append("")
    over = sorted(((law, len(v[("raw", "over budget")]) + len(v[("prepared", "over budget")])) for law, v in rows.items()),
                  key=lambda p: -p[1])
    always = [law for law, n in over if n >= 2 * len(files) and len(files) > 0]
    out.append(f"Checks over budget on every file and stage ({len(always)}): {', '.join(always)}")
    sometimes = [f"{law} ({n})" for law, n in over if 0 < n < 2 * len(files)]
    out.append(f"Checks over budget on some (count of file-stages): {', '.join(sometimes) or 'none'}")
    passing = [law for law, v in rows.items() if law not in failing and not any(fs for k, fs in v.items() if k[1] == "over budget")]
    out.append(f"Checks that pass on every file and stage: {len(passing)} of {len(rows)}")
    text = "\n".join(out)
    print(text)
    if args.write:
        with open(args.write, "w", encoding="utf-8", newline="\n") as f:
            f.write(text + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
