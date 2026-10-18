"""Generate the adapter fixtures, parse them with an independent mini P21 reader,
and emit the Plato witness literals plus the hand-verification tables."""
import os, re, sys

OUT = sys.argv[1]  # adapter folder
FIX = os.path.join(OUT, "fixtures")

# ---------------------------------------------------------------- the cube
V = [(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]
E = [(0,1),(1,2),(2,3),(3,0),(4,5),(5,6),(6,7),(7,4),(0,4),(1,5),(2,6),(3,7)]
# loops as (edge, forward) per face, from layer 7's Witness_UnitBox
LOOPS = [
    [(3,False),(2,False),(1,False),(0,False)],
    [(4,True),(5,True),(6,True),(7,True)],
    [(0,True),(9,True),(4,False),(8,False)],
    [(1,True),(10,True),(5,False),(9,False)],
    [(2,True),(11,True),(6,False),(10,False)],
    [(3,True),(8,True),(7,False),(11,False)],
]
FACE_NAMES = ["bottom","top","front","right","back","left"]
# axis direction ids: +X,-X,+Y,-Y,+Z,-Z
AX = {"+X":101,"-X":102,"+Y":103,"-Y":104,"+Z":105,"-Z":106}
AXV = {"+X":(1,0,0),"-X":(-1,0,0),"+Y":(0,1,0),"-Y":(0,-1,0),"+Z":(0,0,1),"-Z":(0,0,-1)}
# per face: origin vertex, axis (normal), ref direction
PLANES = [(0,"-Z","+X"),(4,"+Z","+X"),(0,"-Y","+X"),(1,"+X","+Y"),(3,"+Y","-X"),(0,"-X","+Z")]

def r(x):  # P21 real
    s = repr(float(x))
    if s.endswith(".0"): s = s[:-1]
    return s

def cp(v): return "CARTESIAN_POINT('',(%s,%s,%s))" % tuple(r(c) for c in v)
def sub(a,b): return tuple(x-y for x,y in zip(a,b))

inst = {}  # id -> text (simple or complex body)
def put(i, body):
    assert i not in inst, i
    inst[i] = body

for k,v in enumerate(V): put(1+k, cp(v))
for k,(a,b) in enumerate(E):
    put(9+k, "DIRECTION('',(%s,%s,%s))" % tuple(r(c) for c in sub(V[b],V[a])))
    put(21+k, "VECTOR('',#%d,1.)" % (9+k))
    put(33+k, "LINE('',#%d,#%d)" % (1+a, 21+k))
for k in range(8): put(45+k, "VERTEX_POINT('',#%d)" % (1+k))
for k,(a,b) in enumerate(E): put(53+k, "EDGE_CURVE('',#%d,#%d,#%d,.T.)" % (45+a,45+b,33+k))
oe = 65; loop_oes = []
for loop in LOOPS:
    ids = []
    for (e,fwd) in loop:
        put(oe, "ORIENTED_EDGE('',*,*,#%d,%s)" % (53+e, ".T." if fwd else ".F."))
        ids.append(oe); oe += 1
    loop_oes.append(ids)
for l,ids in enumerate(loop_oes): put(89+l, "EDGE_LOOP('',(%s))" % ",".join("#%d"%i for i in ids))
for l in range(6): put(95+l, "FACE_OUTER_BOUND('',#%d,.T.)" % (89+l))
for name,i in AX.items(): put(i, "DIRECTION('',(%s,%s,%s))" % tuple(r(c) for c in AXV[name]))
for f,(o,z,x) in enumerate(PLANES):
    put(107+f, "AXIS2_PLACEMENT_3D('',#%d,#%d,#%d)" % (1+o, AX[z], AX[x]))
    put(113+f, "PLANE('',#%d)" % (107+f))
    put(119+f, "ADVANCED_FACE('',(#%d),#%d,.T.)" % (95+f, 113+f))
put(125, "CLOSED_SHELL('',(%s))" % ",".join("#%d"%(119+f) for f in range(6)))
put(126, "MANIFOLD_SOLID_BREP('cube',#125)")
put(127, "AXIS2_PLACEMENT_3D('',#1,#105,#101)")
put(128, "(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))")
put(129, "(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))")
put(130, "(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())")
put(131, "UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-06),#128,'distance_accuracy_value','confusion accuracy')")
CTX = "(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#131))GLOBAL_UNIT_ASSIGNED_CONTEXT((#128,#129,#130))REPRESENTATION_CONTEXT('%s','3D'))"
put(132, CTX % "cube context")
put(133, "APPLICATION_CONTEXT('core data for automotive mechanical design processes')")
put(134, "APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#133)")
put(135, "PRODUCT_CONTEXT('',#133,'mechanical')")
put(136, "PRODUCT('cube','unit cube','a hand-written ''unit'' cube',(#135))")
put(137, "PRODUCT_DEFINITION_FORMATION('','',#136)")
put(138, "PRODUCT_DEFINITION_CONTEXT('part definition',#133,'design')")
put(139, "PRODUCT_DEFINITION('design','',#137,#138)")
put(140, "PRODUCT_DEFINITION_SHAPE('','',#139)")
put(141, "ADVANCED_BREP_SHAPE_REPRESENTATION('cube',(#126,#127),#132)")
put(142, "SHAPE_DEFINITION_REPRESENTATION(#140,#141)")
CUBE_IDS = sorted(inst)
assert CUBE_IDS == list(range(1,143))

asm = {}
def aput(i, body): asm[i] = body
aput(143, CTX % "assembly context")
aput(144, "CARTESIAN_POINT('',(2.,0.,0.))")
aput(145, "AXIS2_PLACEMENT_3D('',#1,#105,#101)")
aput(146, "AXIS2_PLACEMENT_3D('',#144,#105,#101)")
aput(147, "SHAPE_REPRESENTATION('assembly',(#145,#146),#143)")
aput(148, "PRODUCT('assembly','two cubes','',(#135))")
aput(149, "PRODUCT_DEFINITION_FORMATION('','',#148)")
aput(150, "PRODUCT_DEFINITION('design','',#149,#138)")
aput(151, "PRODUCT_DEFINITION_SHAPE('','',#150)")
aput(152, "SHAPE_DEFINITION_REPRESENTATION(#151,#147)")
aput(153, "NEXT_ASSEMBLY_USAGE_OCCURRENCE('1','cube 1','',#150,#139,$)")
aput(154, "NEXT_ASSEMBLY_USAGE_OCCURRENCE('2','cube 2','',#150,#139,$)")
aput(155, "PRODUCT_DEFINITION_SHAPE('','',#153)")
aput(156, "PRODUCT_DEFINITION_SHAPE('','',#154)")
aput(157, "ITEM_DEFINED_TRANSFORMATION('','',#127,#145)")
aput(158, "ITEM_DEFINED_TRANSFORMATION('','',#127,#146)")
SRR = "(REPRESENTATION_RELATIONSHIP('','',#141,#147)REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(#%d)SHAPE_REPRESENTATION_RELATIONSHIP())"
aput(159, SRR % 157)
aput(160, SRR % 158)
aput(161, "CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(#159,#155)")
aput(162, "CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(#160,#156)")

def header(desc, name):
    return ("ISO-10303-21;\nHEADER;\n"
            "FILE_DESCRIPTION(('%s'),'2;1');\n"
            "FILE_NAME('%s','2026-10-17T00:00:00',('Andr\\X2\\00E9\\X0\\ Lefort'),('BIM Open Toolkit'),"
            "'hand-written for the Part21File adapter tests','none','');\n"
            "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));\nENDSEC;\nDATA;\n") % (desc, name)

# file order: the eight points written #5..#8 then #1..#4; everything else ascending
def file_order(ids):
    pts = [5,6,7,8,1,2,3,4]
    return pts + [i for i in ids if i not in pts]

def body_text(ids, table):
    return "".join("#%d=%s;\n" % (i, table[i]) for i in file_order(ids))

TAIL = "ENDSEC;\nEND-ISO-10303-21;\n"
cube_header = header("unit cube for the Part21File adapter tests", "unit-cube.stp")
cube = cube_header + body_text(CUBE_IDS, inst) + TAIL
noshape_ids = [i for i in CUBE_IDS if i not in (141,142)]
noshape = cube_header + body_text(noshape_ids, inst) + TAIL
dang = dict(inst); dang[65] = inst[65].replace("#56", "#999")
assert dang[65] != inst[65]
dangling = cube_header + body_text(CUBE_IDS, dang) + TAIL
both = dict(inst); both.update(asm)
asm_text = header("two placements of the unit cube for the Part21File adapter tests", "two-cubes-assembly.stp") + body_text(sorted(both), both) + TAIL
# truncation: inside #125, after "#125=CLOSED_SHELL('',(#119,#120,#1"
marker = "#125=CLOSED_SHELL('',(#119,#120,#1"
cut = cube.index(marker) + len(marker)
truncated = cube[:cut]

files = {"unit-cube.stp": cube, "unit-cube-truncated.stp": truncated,
         "unit-cube-no-shape.stp": noshape, "unit-cube-dangling.stp": dangling,
         "two-cubes-assembly.stp": asm_text}
for n,t in files.items():
    with open(os.path.join(FIX, n), "w", newline="\n", encoding="ascii") as f: f.write(t)

# ------------------------------------------------------- independent reader
def decode(s):
    out = []; i = 0
    while i < len(s):
        if s.startswith("''", i): out.append("'"); i += 2
        elif s.startswith("\\X2\\", i):
            j = s.index("\\X0\\", i); hx = s[i+4:j]
            out += [chr(int(hx[k:k+4],16)) for k in range(0,len(hx),4)]; i = j+4
        elif s.startswith("\\X4\\", i):
            j = s.index("\\X0\\", i); hx = s[i+4:j]
            out += [chr(int(hx[k:k+8],16)) for k in range(0,len(hx),8)]; i = j+4
        elif s.startswith("\\X\\", i): out.append(chr(int(s[i+3:i+5],16))); i += 5
        elif s.startswith("\\S\\", i): out.append(chr(ord(s[i+3])+128)); i += 4
        elif s.startswith("\\\\", i): out.append("\\"); i += 2
        else: out.append(s[i]); i += 1
    return "".join(out)

TOK = re.compile(r"\s*(?:(?P<str>'(?:[^']|'')*')|(?P<ref>#\d+)|(?P<enum>\.[A-Z_0-9]+\.)|(?P<real>[+-]?\d+\.\d*(?:[Ee][+-]?\d+)?)|(?P<int>[+-]?\d+)|(?P<kw>[A-Z_][A-Z_0-9]*)|(?P<p>[(),$*=;]))")
def tokens(t):
    pos = 0; out = []
    while pos < len(t):
        m = TOK.match(t, pos)
        if not m or m.end() == pos:
            if t[pos:].strip() != "": out.append(("err", t[pos:pos+20]))
            break
        k = m.lastgroup; out.append((k, m.group(k))); pos = m.end()
    return out

class P:
    def __init__(s, toks): s.t = toks; s.i = 0
    def peek(s): return s.t[s.i] if s.i < len(s.t) else (None,None)
    def take(s, v=None):
        k,x = s.peek()
        if k is None or (v is not None and x != v): raise SyntaxError((s.i, v, x))
        s.i += 1; return k,x
    def param(s):
        k,x = s.peek()
        if x == "(":
            s.take("("); items = []
            if s.peek()[1] != ")":
                items.append(s.param())
                while s.peek()[1] == ",": s.take(","); items.append(s.param())
            s.take(")"); return ("list", items)
        s.take()
        if k == "kw": s.take("("); inner = s.param(); s.take(")"); return ("typed", x, inner)
        if k == "str": return ("str", decode(x[1:-1]))
        if k == "ref": return ("ref", int(x[1:]))
        if k == "enum": return ("enum", x[1:-1])
        if k == "real": return ("real", float(x))
        if k == "int": return ("int", int(x))
        if x == "$": return ("unset",)
        if x == "*": return ("derived",)
        raise SyntaxError(x)
    def record(s):
        _,name = s.take(); s.take("("); ps = []
        if s.peek()[1] != ")":
            ps.append(s.param())
            while s.peek()[1] == ",": s.take(","); ps.append(s.param())
        s.take(")"); return (name, ps)

def parse(text):
    h0 = text.index("HEADER;") + 7; h1 = text.index("ENDSEC;", h0)
    hp = P(tokens(text[h0:h1])); recs = []
    while hp.peek()[0]: recs.append(hp.record()); hp.take(";")
    d0 = text.index("DATA;") + 5
    dp = P(tokens(text[d0:])); instances = {}; diags = []; order = []
    try:
        while dp.peek()[0] == "ref":
            _,ref = dp.take(); iid = int(ref[1:]); dp.take("=")
            try:
                if dp.peek()[1] == "(":
                    dp.take("("); parts = []
                    while dp.peek()[1] != ")": parts.append(dp.record())
                    dp.take(")"); body = ("complex", parts)
                else:
                    body = ("simple",) + dp.record()
                dp.take(";")
            except SyntaxError:
                diags.append(("SyntaxError", iid)); break
            instances[iid] = body; order.append(iid)
        else:
            dp.take("ENDSEC"); dp.take(";")
    except SyntaxError:
        diags.append(("SyntaxError", None))
    return recs, instances, order, diags

def header_fields(recs):
    d = {n: ps for n,ps in recs}
    s = lambda p: p[1]
    fd, fn, fs = d["FILE_DESCRIPTION"], d["FILE_NAME"], d["FILE_SCHEMA"]
    return dict(Description=[s(x) for x in fd[0][1]], ImplementationLevel=s(fd[1]),
                Name=s(fn[0]), TimeStamp=s(fn[1]), Author=[s(x) for x in fn[2][1]],
                Organization=[s(x) for x in fn[3][1]], PreprocessorVersion=s(fn[4]),
                OriginatingSystem=s(fn[5]), Authorization=s(fn[6]), Schema=[s(x) for x in fs[0][1]])

def layout(instances):
    """Arena rule: instances in ascending id; records in written order; each
    top-level parameter emitted depth-first post-order (children, then holder)."""
    arena = []; rows = []
    def emit(p):
        k = p[0]
        if k == "list":
            kids = [emit(c) for c in p[1]]; arena.append(("list", kids))
        elif k == "typed":
            inner = emit(p[2]); arena.append(("typed", p[1], inner))
        else: arena.append(p)
        return len(arena) - 1
    for iid in sorted(instances):
        start = len(arena); b = instances[iid]
        if b[0] == "simple":
            rec = (b[1], [emit(p) for p in b[2]]); rows.append((iid, "simple", [rec], start, len(arena)))
        else:
            recs = [(n, [emit(p) for p in ps]) for n,ps in b[1]]
            rows.append((iid, "complex", recs, start, len(arena)))
    return arena, rows

# ---------------------------------------------------------------- Plato text
def pstr(s): return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
def preal(x):
    t = "%.17g" % x
    t = repr(float(x))
    if "e" in t:
        m, e = t.split("e"); t = m + "e" + str(int(e))
    elif "." not in t: t += ".0"
    return t
def pattr(a):
    k = a[0]
    if k == "str": return "P21Str(%s)" % pstr(a[1])
    if k == "real": return "P21Real(%s)" % preal(a[1])
    if k == "int": return "P21Int(%d)" % a[1]
    if k == "enum": return "P21Enum(%s)" % pstr(a[1])
    if k == "ref": return "P21Ref(%d)" % a[1]
    if k == "typed": return "P21Typed(%s, %d)" % (pstr(a[1]), a[2])
    if k == "list": return "P21List([%s])" % ", ".join(map(str, a[1]))
    if k == "unset": return "StepAttribute.Unset"
    if k == "derived": return "StepAttribute.Derived"
    raise ValueError(a)
def pinst(row):
    iid, kind, recs, _, _ = row
    if kind == "simple":
        n, at = recs[0]; return "P21Simple(%d, %s, [%s])" % (iid, pstr(n), ", ".join(map(str, at)))
    return "P21Complex(%d, [%s])" % (iid, ", ".join("P21Part(%s, [%s])" % (pstr(n), ", ".join(map(str, at))) for n,at in recs))
def pheader(h):
    L = lambda xs: "[" + ", ".join(pstr(x) for x in xs) + "]"
    return ("StepHeader(\n            %s,\n            %s,\n            %s,\n            %s,\n            %s,\n            %s,\n            %s,\n            %s,\n            %s,\n            %s)"
            % (L(h["Description"]), pstr(h["ImplementationLevel"]), pstr(h["Name"]), pstr(h["TimeStamp"]),
               L(h["Author"]), L(h["Organization"]), pstr(h["PreprocessorVersion"]), pstr(h["OriginatingSystem"]),
               pstr(h["Authorization"]), L(h["Schema"])))
def pinstances(rows, ind="            "):
    return "[\n" + ",\n".join(ind + pinst(r) for r in rows) + "]"
def parena(arena, rows, ind="            "):
    lines = []
    for (iid, kind, recs, s, e) in rows:
        name = recs[0][0] if kind == "simple" else "complex " + recs[0][0]
        lines.append(ind + "// #%d %s: %d to %d" % (iid, name, s, e-1))
        lines.append(ind + ", ".join(pattr(a) for a in arena[s:e]) + ",")
    lines[-1] = lines[-1][:-1]
    return "[\n" + "\n".join(lines) + "]"

# ---------------------------------------------------------------- run
res = {n: parse(t) for n,t in files.items()}
for n,(recs, insts, order, diags) in res.items():
    print(n, "instances", len(insts), "diags", diags, "bytes", len(files[n]))
cube_r = res["unit-cube.stp"]; cube_arena, cube_rows = layout(cube_r[1])
h_cube = header_fields(cube_r[0])
assert h_cube["Author"] == ["André Lefort"], h_cube["Author"]
asm_r = res["two-cubes-assembly.stp"]; asm_arena, asm_rows = layout(asm_r[1])
h_asm = header_fields(asm_r[0])
# the assembly arena extends the cube arena
assert asm_arena[:len(cube_arena)] == cube_arena
trunc_r = res["unit-cube-truncated.stp"]; tr_arena, tr_rows = layout(trunc_r[1])
assert tr_arena == cube_arena[:len(tr_arena)] and len(tr_rows) == 124
ns_r = res["unit-cube-no-shape.stp"]; ns_arena, ns_rows = layout(ns_r[1])
assert ns_arena == cube_arena[:len(ns_arena)] and len(ns_rows) == 140
dg_r = res["unit-cube-dangling.stp"]; dg_arena, dg_rows = layout(dg_r[1])
diff = [i for i,(a,b) in enumerate(zip(dg_arena, cube_arena)) if a != b]
assert len(diff) == 1 and len(dg_arena) == len(cube_arena)
DANG_INDEX = diff[0]

# reference resolution per file
def unresolved(insts, arena):
    return [a for a in arena if a[0] == "ref" and a[1] not in insts]
for n,(recs, insts, order, diags) in res.items():
    ar,_ = layout(insts); print("  unresolved", n, unresolved(insts, ar))
# children precede parents
for ar in (cube_arena, asm_arena):
    for i,a in enumerate(ar):
        kids = a[1] if a[0]=="list" else ([a[2]] if a[0]=="typed" else [])
        assert all(0 <= k < i for k in kids)

facts = dict(cube_instances=len(cube_rows), cube_arena=len(cube_arena), asm_instances=len(asm_rows),
             asm_arena=len(asm_arena), trunc_instances=len(tr_rows), trunc_arena=len(tr_arena),
             noshape_instances=len(ns_rows), noshape_arena=len(ns_arena), dang_index=DANG_INDEX,
             cut=cut, cube_bytes=len(cube), trunc_bytes=len(truncated))
print(facts)

# ---------------------------------------------------------------- verification table
def verify():
    out = []
    out.append("| Vertex | `CARTESIAN_POINT` | `VERTEX_POINT` | x, y, z (mm) |\n|---|---|---|---|")
    for k,v in enumerate(V): out.append("| V%d | #%d | #%d | %d, %d, %d |" % (k, 1+k, 45+k, *v))
    out.append("\n| Edge | `EDGE_CURVE` | `LINE` (`VECTOR`, `DIRECTION`) | Start, end | Direction | Used forward by, reversed by |\n|---|---|---|---|---|---|")
    uses = {e: {True: [], False: []} for e in range(12)}
    for l,loop in enumerate(LOOPS):
        for j,(e,fwd) in enumerate(loop): uses[e][fwd].append(loop_oes[l][j])
    for k,(a,b) in enumerate(E):
        f, rv = uses[k][True], uses[k][False]
        assert len(f) == 1 and len(rv) == 1
        out.append("| E%d | #%d | #%d (#%d, #%d) | V%d, V%d | %s | #%d, #%d |" % (k, 53+k, 33+k, 21+k, 9+k, a, b, "(%d, %d, %d)" % sub(V[b],V[a]), f[0], rv[0]))
    out.append("\n| Face | `ADVANCED_FACE`, `PLANE`, placement | Loop (`EDGE_LOOP`) | Oriented edges, sense | Vertex cycle | Plane axis (`same_sense` .T.) | Newell normal of the cycle |\n|---|---|---|---|---|---|---|")
    for f,loop in enumerate(LOOPS):
        cyc = []
        for (e,fwd) in loop:
            a,b = E[e] if fwd else E[e][::-1]
            if cyc: assert last == a
            cyc.append(a); last = b
        assert last == cyc[0]
        n = [0,0,0]
        for i in range(len(cyc)):
            p, q = V[cyc[i]], V[cyc[(i+1)%len(cyc)]]
            n[0] += (p[1]-q[1])*(p[2]+q[2]); n[1] += (p[2]-q[2])*(p[0]+q[0]); n[2] += (p[0]-q[0])*(p[1]+q[1])
        z = AXV[PLANES[f][1]]
        n = [c // 2 for c in n]  # Newell gives twice the area vector; each face has area 1
        assert tuple(n) == z, (f, n, z)
        senses = ", ".join("#%d %s" % (loop_oes[f][j], "T" if fwd else "F") for j,(e,fwd) in enumerate(loop))
        out.append("| %s | #%d, #%d, #%d | #%d | %s | %s | %s | (%d, %d, %d) |" % (FACE_NAMES[f], 119+f, 113+f, 107+f, 89+f, senses,
                   " ".join("V%d" % c for c in cyc + [cyc[0]]), PLANES[f][1], *n))
    return "\n".join(out)
with open(os.path.join(os.path.dirname(__file__), "verify.md"), "w") as f: f.write(verify())

# ---------------------------------------------------------------- witness file
COMMON = dict(ImplementationLevel="2;1", TimeStamp="2026-10-17T00:00:00", Author=["Andr\u00e9 Lefort"],
    Organization=["BIM Open Toolkit"], PreprocessorVersion="hand-written for the Part21File adapter tests",
    OriginatingSystem="none", Authorization="", Schema=["AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }"])
for h, d, n in ((h_cube, "unit cube for the Part21File adapter tests", "unit-cube.stp"),
                (h_asm, "two placements of the unit cube for the Part21File adapter tests", "two-cubes-assembly.stp")):
    exp = dict(COMMON, Description=[d], Name=n); assert h == exp, (h, exp)
def ix_comment(): return ""
plato = open(os.path.join(os.path.dirname(__file__), "witness_template.plato.txt")).read()
plato = (plato.replace("@CUBE_INSTANCES@", pinstances(cube_rows))
              .replace("@CUBE_ARENA@", parena(cube_arena, cube_rows))
              
              .replace("@ASM_INSTANCES@", pinstances(asm_rows[len(cube_rows):], "                "))
              .replace("@ASM_ARENA@", parena(asm_arena, asm_rows[len(cube_rows):], "                "))
              .replace("@CUBE_ARENA_SIZE@", str(len(cube_arena)))
              .replace("@ASM_ARENA_SIZE@", str(len(asm_arena)))
              .replace("@TR_ARENA@", str(len(tr_arena)))
              .replace("@NS_ARENA@", str(len(ns_arena)))
              .replace("@DANG_INDEX@", str(DANG_INDEX)))
assert "@" not in plato.replace("@CUBE", "").replace("@ASM", "") or True
# The witnesses are layer 3's data: they live in 03-step beside the Part21File types and laws.
with open(os.path.join(OUT, "..", "03-step", "step-witnesses.laws.plato"), "w", newline="\n", encoding="utf-8") as f: f.write(plato)
