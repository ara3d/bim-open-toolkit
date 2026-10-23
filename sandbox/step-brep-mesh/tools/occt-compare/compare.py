"""Compare the Plato STEP mesher with OpenCascade's BRepMesh on one STEP file.

Both meshes are measured against the exact B-rep as OpenCascade reads it, so neither mesher grades the other:

- deviation: points sampled inside each mesh's triangles (where chordal error lives; vertices lie on the surface by
  construction) projected onto the exact surface of the nearest face. The nearest face is found through OpenCascade's
  own mesh, then GeomAPI_ProjectPointOnSurf measures the distance to that face's surface.
- coverage: points sampled on the exact-surface side (OpenCascade's mesh) and their distance to the Plato mesh. A large
  distance means a region the Plato mesh leaves out, such as an unmeshed face.
- area: each mesh's area against BRepGProp's exact area.

Usage:
  python compare.py <file.step> <plato.glb> <out.json> [--chordal mm] [--angular rad] [--samples n]

<plato.glb> and <plato.json> come from `step-corpus-harness gallery <file.step> <plato.glb> --chordal mm --parallel --warmup`
(deps/bim-open-data/tools/step-corpus-harness). Positions there are millimetres with the JSON's `centre` subtracted.
"""
import argparse
import json
import struct
import time
from pathlib import Path

import numpy as np
import trimesh
from OCP.BRep import BRep_Tool
from OCP.BRepGProp import BRepGProp
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.GeomAPI import GeomAPI_ProjectPointOnSurf
from OCP.GProp import GProp_GProps
from OCP.IFSelect import IFSelect_RetDone
from OCP.STEPControl import STEPControl_Reader
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED
from OCP.TopExp import TopExp_Explorer
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS
from OCP.gp import gp_Pnt


def read_step(path):
    reader = STEPControl_Reader()
    if reader.ReadFile(str(path)) != IFSelect_RetDone:
        raise RuntimeError(f"OpenCascade could not read {path}")
    reader.TransferRoots()
    return reader.OneShape()


def faces_of(shape):
    explorer = TopExp_Explorer(shape, TopAbs_FACE)
    faces = []
    while explorer.More():
        faces.append(TopoDS.Face(explorer.Current()))
        explorer.Next()
    return faces


def occt_triangles(faces):
    """Every face's triangulation in world coordinates: (n, 3, 3) corners and the face index of each triangle."""
    corners, owner, unmeshed = [], [], 0
    for index, face in enumerate(faces):
        loc = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(face, loc)
        if tri is None:
            unmeshed += 1
            continue
        trsf = loc.Transformation()
        nodes = np.array([tri.Node(i).Transformed(trsf).Coord() for i in range(1, tri.NbNodes() + 1)])
        idx = np.array([tri.Triangle(i).Get() for i in range(1, tri.NbTriangles() + 1)]) - 1
        if face.Orientation() == TopAbs_REVERSED:
            idx = idx[:, [0, 2, 1]]
        corners.append(nodes[idx])
        owner.append(np.full(len(idx), index))
    return np.concatenate(corners), np.concatenate(owner), unmeshed


def read_glb_triangles(glb_path, centre):
    """The triangle primitive of the harness's gallery GLB, shifted back by the centre it subtracted."""
    data = Path(glb_path).read_bytes()
    json_len = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + json_len])
    bin_start = 20 + json_len + 8
    for prim in gltf["meshes"][0]["primitives"]:
        if prim.get("mode", 4) != 4:
            continue
        acc = gltf["accessors"][prim["attributes"]["POSITION"]]
        view = gltf["bufferViews"][acc["bufferView"]]
        offset = bin_start + view.get("byteOffset", 0) + acc.get("byteOffset", 0)
        pos = np.frombuffer(data, dtype="<f4", count=acc["count"] * 3, offset=offset).reshape(-1, 3).astype(float)
        return (pos + np.asarray(centre)).reshape(-1, 3, 3)
    return np.zeros((0, 3, 3))


def area(corners):
    return 0.5 * np.linalg.norm(np.cross(corners[:, 1] - corners[:, 0], corners[:, 2] - corners[:, 0]), axis=1)


def sample(corners, n, rng):
    """n points inside the triangles, chosen by area, at uniform barycentric positions."""
    a = area(corners)
    pick = rng.choice(len(corners), size=n, p=a / a.sum())
    r1, r2 = rng.random(n), rng.random(n)
    flip = r1 + r2 > 1
    r1[flip], r2[flip] = 1 - r1[flip], 1 - r2[flip]
    c = corners[pick]
    return c[:, 0] + r1[:, None] * (c[:, 1] - c[:, 0]) + r2[:, None] * (c[:, 2] - c[:, 0])


def to_trimesh(corners):
    return trimesh.Trimesh(vertices=corners.reshape(-1, 3), faces=np.arange(len(corners) * 3).reshape(-1, 3), process=False)


def surface_distances(points, locator, owner, faces):
    """Distance from each point to the exact surface of the face whose OpenCascade triangle is nearest."""
    _, _, tri = trimesh.proximity.closest_point(locator, points)
    surfaces = {}
    out = np.empty(len(points))
    failed = 0
    for i, (p, t) in enumerate(zip(points, tri)):
        f = int(owner[t])
        surf = surfaces.get(f) or surfaces.setdefault(f, BRep_Tool.Surface_s(faces[f]))
        proj = GeomAPI_ProjectPointOnSurf(gp_Pnt(*p), surf)
        if proj.NbPoints() > 0:
            out[i] = proj.LowerDistance()
        else:
            out[i] = np.nan
            failed += 1
    return out, failed


def stats(d, chordal):
    d = d[~np.isnan(d)]
    return {
        "max": float(d.max()), "p99": float(np.percentile(d, 99)), "p95": float(np.percentile(d, 95)),
        "mean": float(d.mean()), "over_chordal": int((d > chordal).sum()), "over_2x_chordal": int((d > 2 * chordal).sum()),
        "samples": int(len(d)),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step")
    ap.add_argument("glb")
    ap.add_argument("out")
    ap.add_argument("--chordal", type=float, default=1.0)
    ap.add_argument("--angular", type=float, default=0.5)
    ap.add_argument("--samples", type=int, default=20000)
    a = ap.parse_args()
    rng = np.random.default_rng(1)
    plato_json = json.loads(Path(a.glb).with_suffix(".json").read_text())

    t0 = time.perf_counter()
    shape = read_step(a.step)
    t1 = time.perf_counter()
    BRepMesh_IncrementalMesh(shape, a.chordal, False, a.angular, True)
    t2 = time.perf_counter()
    faces = faces_of(shape)
    occt, owner, occt_unmeshed = occt_triangles(faces)
    props = GProp_GProps()
    BRepGProp.SurfaceProperties_s(shape, props)
    exact_area = props.Mass()

    plato = read_glb_triangles(a.glb, plato_json["centre"])
    locator = to_trimesh(occt)
    plato_mesh = to_trimesh(plato)

    n = a.samples
    plato_dev, plato_fail = surface_distances(sample(plato, n, rng), locator, owner, faces)
    occt_dev, occt_fail = surface_distances(sample(occt, n, rng), locator, owner, faces)
    _, coverage, _ = trimesh.proximity.closest_point(plato_mesh, sample(occt, n, rng))

    result = {
        "file": str(a.step), "chordal_mm": a.chordal, "occt_angular_rad": a.angular,
        "bbox": {"occt": [occt.reshape(-1, 3).min(0).tolist(), occt.reshape(-1, 3).max(0).tolist()],
                 "plato": [plato.reshape(-1, 3).min(0).tolist(), plato.reshape(-1, 3).max(0).tolist()]},
        "faces": {"occt": len(faces), "occt_unmeshed": occt_unmeshed,
                  "plato": plato_json["faces"], "plato_meshed": plato_json["meshedFaces"]},
        "triangles": {"occt": len(occt), "plato": len(plato)},
        "ms": {"occt_read": (t1 - t0) * 1000, "occt_mesh": (t2 - t1) * 1000,
               "plato_total": plato_json["ms"]["total"], "plato_after_prepare": sum(
                   plato_json["ms"][k] for k in ("tables", "edges", "faces", "refine", "assemble"))},
        "area_mm2": {"exact": exact_area, "occt": float(area(occt).sum()), "plato": float(area(plato).sum())},
        "deviation_from_exact": {"plato": stats(plato_dev, a.chordal) | {"projection_failed": plato_fail},
                                 "occt": stats(occt_dev, a.chordal) | {"projection_failed": occt_fail}},
        "coverage_occt_to_plato": stats(coverage, a.chordal),
        "plato_contract": plato_json["contract"]["verdict"],
    }
    Path(a.out).write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
