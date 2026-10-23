"""Run compare.py over every STEP file in a folder and write one CSV row per file.

Usage:
  python run_corpus.py <step-corpus-harness.exe> <corpus folder> <out folder> [--chordal mm] [--samples n] [--timeout s]

Each file is meshed by the Plato harness (gallery mode, --parallel --warmup) and then compared by compare.py, each in
its own process with the time limit. Files already compared in <out folder> are skipped, so a stopped run resumes.
"""
import argparse
import csv
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent

COLUMNS = ["file", "status", "faces", "occt_faces", "plato_meshed", "occt_unmeshed", "plato_triangles", "occt_triangles",
           "plato_ms", "occt_ms", "area_exact", "area_plato_rel", "area_occt_rel",
           "plato_dev_max", "plato_dev_p99", "occt_dev_max", "occt_dev_p99", "plato_over_chordal", "occt_over_chordal",
           "plato_projection_failed", "coverage_max", "coverage_p99", "coverage_over_chordal", "bbox_gap", "contract"]


def row(rel, r):
    a, d = r["area_mm2"], r["deviation_from_exact"]
    box = r["bbox"]
    gap = max(abs(p - o) for side in (0, 1) for p, o in zip(box["plato"][side], box["occt"][side]))
    return {
        "file": rel, "status": "done", "faces": r["faces"]["plato"], "occt_faces": r["faces"]["occt"],
        "plato_meshed": r["faces"]["plato_meshed"], "occt_unmeshed": r["faces"]["occt_unmeshed"],
        "plato_triangles": r["triangles"]["plato"], "occt_triangles": r["triangles"]["occt"],
        "plato_ms": round(r["ms"]["plato_after_prepare"]), "occt_ms": round(r["ms"]["occt_mesh"]),
        "area_exact": round(a["exact"], 3), "area_plato_rel": f"{(a['plato'] - a['exact']) / a['exact']:.2e}",
        "area_occt_rel": f"{(a['occt'] - a['exact']) / a['exact']:.2e}",
        "plato_dev_max": f"{d['plato']['max']:.3g}", "plato_dev_p99": f"{d['plato']['p99']:.3g}",
        "occt_dev_max": f"{d['occt']['max']:.3g}", "occt_dev_p99": f"{d['occt']['p99']:.3g}",
        "plato_over_chordal": d["plato"]["over_chordal"], "occt_over_chordal": d["occt"]["over_chordal"],
        "plato_projection_failed": d["plato"]["projection_failed"],
        "coverage_max": f"{r['coverage_occt_to_plato']['max']:.3g}", "coverage_p99": f"{r['coverage_occt_to_plato']['p99']:.3g}",
        "coverage_over_chordal": r["coverage_occt_to_plato"]["over_chordal"], "bbox_gap": f"{gap:.3g}",
        "contract": r["plato_contract"].split(" faces")[0],
    }


def run(cmd, timeout):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stderr or p.stdout).strip().splitlines()[-1:] or [""]
    except subprocess.TimeoutExpired:
        return -1, ["timeout"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("harness")
    ap.add_argument("corpus")
    ap.add_argument("out")
    ap.add_argument("--chordal", type=float, default=0.1)
    ap.add_argument("--samples", type=int, default=20000)
    ap.add_argument("--timeout", type=int, default=300)
    a = ap.parse_args()
    corpus, out = Path(a.corpus), Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in corpus.rglob("*") if p.suffix.lower() in (".step", ".stp"))
    rows = []
    for i, step in enumerate(files):
        rel = step.relative_to(corpus).as_posix()
        stem = out / rel.replace("/", "__")
        glb, cmp = stem.with_suffix(".glb"), stem.with_suffix(".cmp.json")
        print(f"[{i + 1}/{len(files)}] {rel}", flush=True)
        if not cmp.exists():
            code, msg = run([a.harness, "gallery", str(step), str(glb), "--chordal", str(a.chordal), "--parallel", "--warmup"], a.timeout)
            if code != 0:
                rows.append({"file": rel, "status": f"plato failed: {msg[0]}"})
                continue
            code, msg = run([sys.executable, str(HERE / "compare.py"), str(step), str(glb), str(cmp),
                             "--chordal", str(a.chordal), "--samples", str(a.samples)], a.timeout)
            if code != 0:
                rows.append({"file": rel, "status": f"compare failed: {msg[0]}"})
                continue
        rows.append(row(rel, json.loads(cmp.read_text())))
    with open(out / "summary.csv", "w", newline="") as f:
        w = csv.DictWriter(f, COLUMNS)
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {out / 'summary.csv'}")


if __name__ == "__main__":
    main()
