"""The STEP mesher's corpus report from a step-corpus-harness `all` run: the per-surface-kind table and run time,
the per-file CSV, and the totals the report quotes.

Usage: python scripts/step-corpus-table.py <harness out folder> [--write docs/plans/step-reader.md]
           [--csv docs/plans/step-mesher-corpus-<date>.csv] [--previous docs/plans/step-mesher-corpus-<earlier>.csv]
           [--summary]

The out folder is what `step-corpus-harness all <corpus> <out> 120 --path host --parallel --warmup` writes
(deps/bim-open-data/tools/step-corpus-harness/README.md): all.csv, and per file the face, edge and contract tables and
the summary. With no option, prints the surface-kind table; --write replaces the text between the two
step-corpus-table markers in that file with it; --csv writes one row per file (the previous run's outcome, time,
faces meshed, closedness and boundary edges beside it when --previous names that run's CSV); --summary prints the
totals, the contract failures, the unmeshed faces and the changes against the previous run. One command makes a
report: all four options together.
"""
import argparse, csv, json, os, re, statistics, sys
from collections import Counter, defaultdict

LABELS = {'plane': 'plane', 'bspline': 'B-spline', 'cylinder': 'cylinder', 'sphere': 'sphere', 'torus': 'torus',
          'cone': 'cone', 'extrusion': 'surface of linear extrusion', 'revolution': 'surface of revolution',
          'rect-trimmed': 'rectangular trimmed surface', 'offset': 'offset surface'}
# Column, and the test that puts a face row in it; the first test that holds wins.
COLUMNS = [
    ('Meshed', lambda f: meshed(f)),
    ('Edge not discretized', lambda f: f['path'] == 'undiscretized'),
    ('Stubbed', lambda f: f['exception'] == 'NotImplementedException'),
    ('Threw', lambda f: f['exception'] != ''),
    ('Not simple', lambda f: f['path'] == 'not-simple'),
    ('Other unmeshed', lambda f: True),
]
BEGIN, END = '<!-- step-corpus-table:begin -->', '<!-- step-corpus-table:end -->'
STAGES = ['ParseMs', 'DecodeMs', 'PrepareMs', 'TablesMs', 'EdgesMs', 'FacesMs', 'RefineMs', 'AssembleMs']
CSV_COLUMNS = [
    'file', 'status', 'outcome', 'process_ms', 'total_ms', 'parse_ms', 'decode_ms', 'prepare_ms', 'tables_ms',
    'edges_ms', 'faces_ms', 'refine_ms', 'assemble_ms', 'faces', 'faces_meshed', 'faces_threw', 'edges',
    'edges_threw', 'mesh_vertices', 'mesh_triangles', 'mesh_quads', 'hash', 'closed', 'oriented', 'boundary_edges',
    'nonmanifold_edges', 'misoriented_edges', 'closed_shells_closed', 'closed_shells', 'boundary_open_shell',
    'boundary_edge_cited_once', 'boundary_beside_unmeshed_face', 'boundary_gap', 'boundary_inside_face', 'contract', 'over_chordal', 'flipped', 'degenerate', 'unexplained',
    'worst_excess', 'last_stage', 'cause', 'previous_outcome', 'previous_process_ms', 'previous_faces_meshed',
    'previous_closed', 'previous_boundary_edges', 'previous_closed_shells_closed', 'previous_boundary_gap']
# The harness's boundary causes (BoundaryCheck.cs, bim-open-data 97495d8) and their CSV columns: an open shell's
# boundary and an edge the B-rep cites once are the file's; the rest are the mesher's.
CAUSES = {'OpenShell': 'boundary_open_shell', 'EdgeCitedOnce': 'boundary_edge_cited_once',
          'BesideUnmeshedFace': 'boundary_beside_unmeshed_face', 'GapBetweenMeshedFaces': 'boundary_gap',
          'InsideFace': 'boundary_inside_face'}


def meshed(face):
    return int(face['triangles']) + int(face['quads']) > 0


def read_csv(path):
    with open(path, encoding='utf-8') as f:
        return list(csv.DictReader(f))


def name(path):
    return path.replace('\\', '/')


def load(outdir):
    """One record per file of all.csv: its status, process time and last stage, and for a finished file its
    summary and its face, edge and contract tables."""
    files = []
    for r in read_csv(os.path.join(outdir, 'all.csv')):
        stem = os.path.join(outdir, name(r['file']).replace('/', '_'))
        rec = dict(file=name(r['file']), status=r['status'], process_ms=float(r['ms']), last_stage=r['last_stage'],
                   summary=None, faces=None, edges=[], contract=[])
        if r['status'] == 'done' and os.path.exists(stem + '.summary.json') and os.path.exists(stem + '.faces.csv'):
            with open(stem + '.summary.json', encoding='utf-8') as f:
                rec['summary'] = json.load(f)
            rec['faces'] = read_csv(stem + '.faces.csv')
            rec['edges'] = read_csv(stem + '.edges.csv') if os.path.exists(stem + '.edges.csv') else []
            rec['contract'] = read_csv(stem + '.contract.csv') if os.path.exists(stem + '.contract.csv') else []
        files.append(rec)
    return files


def outcome(rec):
    if rec['faces'] is None:
        return rec['status']
    return 'full' if all(meshed(f) for f in rec['faces']) else 'partial'


def table(files):
    kinds = defaultdict(Counter)
    statuses = Counter(outcome(r) for r in files)
    for r in files:
        for f in r['faces'] or []:
            kinds[f['surface']][next(n for n, test in COLUMNS if test(f))] += 1
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
    warm = sorted((r['summary']['TotalMs'], r['file']) for r in files if r['summary'])
    warm_ms = [w for w, _ in warm]
    slowest = warm[-1] if warm else (0, '-')
    text = (f"{len(files)} files: {statuses['full']} meshed fully, {statuses['partial']} partly"
            + ''.join(f", {n} {s}" for s, n in sorted(statuses.items()) if s not in ('full', 'partial'))
            + f". Process time {sum(r['process_ms'] for r in files) / 1000:,.0f} s over the run (each file meshed twice"
            + f" with `--warmup`); warm meshing {sum(warm_ms) / 1000:,.1f} s over the {len(warm_ms)} finished files,"
            + f" median {statistics.median(warm_ms) / 1000 if warm_ms else 0:.1f} s, slowest {slowest[0] / 1000:.1f} s"
            + f" ({slowest[1]}).")
    return '\n'.join(lines) + '\n\n' + text


def field(pattern, text, cast=str):
    m = re.search(pattern, text or '')
    return cast(m.group(1)) if m else ''


def per_file(files, previous):
    """The per-file CSV's rows; previous maps a file to its row in the previous run's CSV."""
    rows = []
    for r in files:
        s, o = r['summary'], previous.get(r['file'], {})
        row = dict(file=r['file'], status=r['status'], outcome=outcome(r), process_ms=round(r['process_ms']),
                   last_stage=r['last_stage'], previous_outcome=o.get('outcome', ''),
                   previous_process_ms=o.get('process_ms', ''), previous_faces_meshed=o.get('faces_meshed', ''),
                   previous_closed=o.get('closed', ''), previous_boundary_edges=o.get('boundary_edges', ''),
                   previous_closed_shells_closed=o.get('closed_shells_closed', ''), previous_boundary_gap=o.get('boundary_gap', ''))
        if s:
            why = Counter({'undiscretized': 'edge not discretized', 'not-simple': 'not simple'}.get(f['path'], 'remeshed empty')
                          for f in r['faces'] if not meshed(f))
            d, ck, con = s.get('Digest') or {}, s.get('Check') or {}, s.get('Contract') or ''
            row.update(total_ms=round(s['TotalMs']), faces=s['Faces'], faces_meshed=sum(meshed(f) for f in r['faces']),
                       faces_threw=s['FacesThrew'], edges=s['Edges'], edges_threw=s['EdgesThrew'],
                       mesh_vertices=d.get('Vertices', ''), mesh_triangles=d.get('Triangles', ''),
                       mesh_quads=d.get('Quads', ''), hash=d.get('Hash', ''), closed=ck.get('Closed', ''),
                       oriented=ck.get('Oriented', ''), boundary_edges=ck.get('BoundaryEdges', ''),
                       nonmanifold_edges=ck.get('NonManifoldEdges', ''), misoriented_edges=ck.get('MisorientedEdges', ''),
                       contract=field(r'contract (\w+)', con), over_chordal=field(r'over-chordal (\d+)', con, int),
                       flipped=field(r'flipped (\d+)', con, int), degenerate=field(r'degenerate (\d+)', con, int),
                       unexplained=field(r'unexplained (\d+)', con, int), worst_excess=field(r'worst-excess (\S+)', con),
                       cause='; '.join(f'{k} {v}' for k, v in sorted(why.items())),
                       closed_shells_closed=s.get('ClosedShellsClosed', ''),
                       closed_shells=field(r'closed shells (\d+/\d+)', s.get('Boundary')),
                       **{col: field(cause + r' (\d+)', s.get('Boundary'), int) for cause, col in CAUSES.items()},
                       **{k[:-2].lower() + '_ms': round(s.get(k, 0)) for k in STAGES})
        rows.append(row)
    return rows


def summary(files, rows, previous):
    """The totals and lists a corpus report quotes, as markdown."""
    done = [r for r in rows if r.get('faces') != '' and 'faces' in r]
    total = lambda k: sum(r[k] for r in done if r.get(k) not in ('', None))
    faces = total('faces')
    out = [f"- Files: {len(rows)}; {dict(Counter(r['outcome'] for r in rows))}.",
           f"- Faces: {faces:,}, meshed {total('faces_meshed'):,} ({100 * total('faces_meshed') / faces if faces else 0:.2f}%);"
           f" edges {total('edges'):,}, edges threw {total('edges_threw')}, faces threw {total('faces_threw')}.",
           f"- Mesh: {total('mesh_vertices'):,} vertices, {total('mesh_triangles'):,} triangles, {total('mesh_quads'):,} quads"
           f" ({total('mesh_triangles') + 2 * total('mesh_quads'):,} triangles once quads are split).",
           f"- Closed {sum(r['closed'] is True for r in done)}, oriented {sum(r['oriented'] is True for r in done)} of {len(done)};"
           f" every closed shell closed in {sum(r['closed_shells_closed'] is True for r in done)}. Boundary edges by cause: "
           + ', '.join(f"{col[9:].replace('_', ' ')} {total(col):,}" for col in CAUSES.values())
           + " (open shell and edge cited once are the file's; the others are the mesher's).",
           f"- Process time {sum(r['process_ms'] for r in rows) / 1000:,.1f} s; warm stages (s): "
           + ', '.join(f"{k[:-2].lower()} {sum(r['summary'].get(k, 0) for r in files if r['summary']) / 1000:,.1f}" for k in STAGES)
           + f"; warm median {statistics.median([r['total_ms'] for r in done]) / 1000 if done else 0:.2f} s.",
           f"- Face paths: {dict(Counter(f['path'] for r in files for f in r['faces'] or []))}."]
    curves = defaultdict(Counter)
    for r in files:
        for e in r['edges']:
            c = curves[e['curve']]
            c['all'] += 1
            c['undiscretized' if e['segments'] in ('', '0') else 'discretized'] += 1
            c['threw'] += bool(e['exception'])
    out.append('- Edges by curve: ' + '; '.join(f"{k} {dict(v)}" for k, v in sorted(curves.items(), key=lambda kv: -kv[1]['all'])) + '.')
    broken = [r for r in done if r.get('contract') == 'broken']
    out.append(f"- Contract: {len(done) - len(broken)} hold, {len(broken)} broken (over chordal {total('over_chordal')},"
               f" flipped {total('flipped')}, degenerate {total('degenerate')}, unexplained {total('unexplained')} faces).")
    for r in files:
        for c in r['contract']:
            out.append(f"  - {r['file']} face {c['face']} {c['surface']}: deviation {c['deviation']} (bound {c['bound']},"
                       f" corner gap {c['corner_gap']}), flipped {c['flipped']}, degenerate {c['degenerate']}, explained {c['explained']}")
    unmeshed = [(r['file'], f) for r in files for f in r['faces'] or [] if not meshed(f)]
    out.append(f"- Unmeshed faces: {len(unmeshed)}.")
    out += [f"  - {fn} face {f['index']} {f['surface']} ({f['path']}, {f['loops']} loops, {f['edges']} edges)"
            + (f": {f['exception']} {f['message'][:120]}" if f['exception'] else '') for fn, f in unmeshed]
    out.append('- Slowest warm: ' + '; '.join(f"{r['file']} {r['total_ms'] / 1000:.1f} s (faces {r['faces_ms'] / 1000:.1f},"
                                             f" refine {r['refine_ms'] / 1000:.1f})"
                                             for r in sorted(done, key=lambda r: -r['total_ms'])[:8]) + '.')
    open_full = [r for r in done if r['outcome'] == 'full' and r['closed'] is False]
    out.append(f"- Fully meshed but not closed: {len(open_full)}: " + '; '.join(
        f"{r['file']} (boundary {r['boundary_edges']}, non-manifold {r['nonmanifold_edges']}, misoriented {r['misoriented_edges']})"
        for r in sorted(open_full, key=lambda r: -r['boundary_edges'])) + '.')
    shells_open = [r for r in done if r['closed_shells_closed'] is False]
    out.append(f"- A closed shell left open: {len(shells_open)}: " + '; '.join(
        f"{r['file']} ({r['closed_shells']} closed; gap {r['boundary_gap']}, inside face {r['boundary_inside_face']},"
        f" beside unmeshed {r['boundary_beside_unmeshed_face']}, non-manifold {r['nonmanifold_edges']})"
        for r in sorted(shells_open, key=lambda r: -(r['boundary_gap'] or 0))) + '.')
    if previous:
        shells_regressed = [r['file'] for r in done if r['previous_closed_shells_closed'] == 'True' and r['closed_shells_closed'] is False]
        out.append(f"- Against the previous run: a closed shell open now that was closed then: {', '.join(shells_regressed) or 'none'}.")
        regressions = [r['file'] for r in done if r['previous_closed'] == 'True' and r['closed'] is False]
        rose = [f"{r['file']} {r['previous_boundary_edges']} -> {r['boundary_edges']}" for r in done
                if r['previous_boundary_edges'] not in ('', None) and r['boundary_edges'] != ''
                and int(r['boundary_edges']) > int(r['previous_boundary_edges'])]
        out.append(f"- Against the previous run: closed then, not now: {', '.join(regressions) or 'none'}; boundary edges rose:"
                   f" {', '.join(rose) or 'none'}.")
    return '\n'.join(out)


def write_block(doc, text):
    with open(doc, encoding='utf-8') as f:
        body = f.read()
    if BEGIN not in body or END not in body:
        sys.exit(f'{doc} has no {BEGIN} ... {END} block')
    head, rest = body.split(BEGIN, 1)
    with open(doc, 'w', encoding='utf-8', newline='\n') as f:
        f.write(head + BEGIN + '\n' + text + '\n' + END + rest.split(END, 1)[1])


def main():
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('outdir')
    p.add_argument('--write', help='a document with step-corpus-table markers to receive the table')
    p.add_argument('--csv', help='the per-file CSV to write')
    p.add_argument('--previous', help="the previous run's per-file CSV, compared in --csv and --summary")
    p.add_argument('--summary', action='store_true', help='print the totals and lists a report quotes')
    a = p.parse_args()
    files = load(a.outdir)
    previous = {name(r['file']): r for r in read_csv(a.previous)} if a.previous else {}
    if a.write:
        write_block(a.write, table(files))
    if a.csv or a.summary:
        rows = per_file(files, previous)
        if a.csv:
            with open(a.csv, 'w', encoding='utf-8', newline='') as f:
                w = csv.DictWriter(f, CSV_COLUMNS, lineterminator='\n', extrasaction='ignore')
                w.writeheader()
                w.writerows(rows)
        if a.summary:
            print(summary(files, rows, previous))
    if not (a.write or a.csv or a.summary):
        print(table(files))


if __name__ == '__main__':
    main()
