"""The STEP mesher's per-surface-kind table and run time, from a step-corpus-harness `all` run.

Usage: python scripts/step-corpus-table.py <harness out folder> [--write docs/plans/step-reader.md]

The out folder is what `step-corpus-harness all <corpus> <out> 120 --path host --parallel --warmup` writes
(deps/bim-open-data/tools/step-corpus-harness/README.md): all.csv, and per file the faces table and the summary.
Prints the markdown; with --write, replaces the text between the two step-corpus-table markers in that file.
"""
import csv, json, os, re, statistics, sys
from collections import Counter, defaultdict

LABELS = {'plane': 'plane', 'bspline': 'B-spline', 'cylinder': 'cylinder', 'sphere': 'sphere', 'torus': 'torus',
          'cone': 'cone', 'extrusion': 'surface of linear extrusion', 'revolution': 'surface of revolution',
          'rect-trimmed': 'rectangular trimmed surface', 'offset': 'offset surface'}
# Column, and the test that puts a face row in it; the first test that holds wins.
COLUMNS = [
    ('Meshed', lambda f: int(f['triangles']) + int(f['quads']) > 0),
    ('Edge not discretized', lambda f: f['path'] == 'undiscretized'),
    ('Stubbed', lambda f: f['exception'] == 'NotImplementedException'),
    ('Threw', lambda f: f['exception'] != ''),
    ('Not simple', lambda f: f['path'] == 'not-simple'),
    ('Other unmeshed', lambda f: True),
]
BEGIN, END = '<!-- step-corpus-table:begin -->', '<!-- step-corpus-table:end -->'


def read_csv(path):
    with open(path, encoding='utf-8') as f:
        return list(csv.DictReader(f))


def table(outdir):
    runs = read_csv(os.path.join(outdir, 'all.csv'))
    kinds = defaultdict(Counter)
    warm, statuses = [], Counter()
    for r in runs:
        stem = os.path.join(outdir, r['file'].replace('\\', '_').replace('/', '_'))
        summary = stem + '.summary.json'
        done = r['status'] == 'done' and os.path.exists(summary) and os.path.exists(stem + '.faces.csv')
        if not done:
            statuses[r['status']] += 1
            continue
        with open(summary, encoding='utf-8') as f:
            warm.append((json.load(f)['TotalMs'], r['file']))
        faces = read_csv(stem + '.faces.csv')
        full = all(COLUMNS[0][1](f) for f in faces)
        statuses['full' if full else 'partial'] += 1
        for f in faces:
            kinds[f['surface']][next(name for name, test in COLUMNS if test(f))] += 1
    total = Counter()
    for c in kinds.values():
        total.update(c)
    names = [n for n, _ in COLUMNS]

    def row(label, c):
        n = sum(c.values())
        share = f"{100 * c['Meshed'] / n:.1f}%" if n else '-'
        return '| ' + ' | '.join([label, f'{n:,}'] + [f'{c[k]:,}' for k in names] + [share]) + ' |'

    lines = ['| Surface | Faces | ' + ' | '.join(names) + ' | Share meshed |', '|---' * (len(names) + 3) + '|']
    lines += [row(LABELS.get(k, k), c) for k, c in sorted(kinds.items(), key=lambda kv: -sum(kv[1].values()))]
    lines.append(re.sub(r'\| ([^|]+?) (?=\|)', r'| **\1** ', row('all', total)))
    process_s = sum(float(r['ms']) for r in runs) / 1000
    warm_ms = sorted(w for w, _ in warm)
    slowest = max(warm) if warm else (0, '-')
    summary = (f"{len(runs)} files: {statuses['full']} meshed fully, {statuses['partial']} partly"
               + ''.join(f", {n} {s}" for s, n in sorted(statuses.items()) if s not in ('full', 'partial'))
               + f". Process time {process_s:,.0f} s over the run (each file meshed twice with `--warmup`); warm meshing"
               + f" {sum(warm_ms) / 1000:,.1f} s over the {len(warm_ms)} finished files, median"
               + f" {statistics.median(warm_ms) / 1000 if warm_ms else 0:.1f} s, slowest {slowest[0] / 1000:.1f} s"
               + f" ({slowest[1].replace(os.sep, '/')}).")
    return '\n'.join(lines) + '\n\n' + summary


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    text = table(args[0])
    if '--write' not in args:
        print(text)
        return
    doc = args[args.index('--write') + 1]
    with open(doc, encoding='utf-8') as f:
        body = f.read()
    if BEGIN not in body or END not in body:
        sys.exit(f'{doc} has no {BEGIN} ... {END} block')
    head, rest = body.split(BEGIN, 1)
    with open(doc, 'w', encoding='utf-8', newline='\n') as f:
        f.write(head + BEGIN + '\n' + text + '\n' + END + rest.split(END, 1)[1])


if __name__ == '__main__':
    main()
