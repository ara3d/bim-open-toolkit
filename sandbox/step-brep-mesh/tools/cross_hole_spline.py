"""The control points of the cross-hole witness's two B-spline edges (07-validation/operation-witnesses.library.plato,
Witness_CrossHole): the curve where a cylinder of radius r along x meets a cylinder of radius R along z is a quartic
with no rational form when r < R, so an exporter writes an approximating B-spline, and so does this script.

    python -I sandbox/step-brep-mesh/tools/cross_hole_spline.py [R r h N]

Prints the Plato for CrossHoleKnots, CrossHoleMultiplicities and the two control-point arrays: a clamped cubic through
N + 1 points of the true curve (the last the first again) at chord-length parameters, with the knots averaged from them
(Piegl and Tiller, The NURBS Book, 9.2.1). With N = 96 the spline stays within 3.5e-7 of both cylinders on a part one
unit across, inside Witness_Tolerances' 1e-6 (N = 48 gives 5.2e-6, outside it). The numbers in the library were made
by this script at its defaults; rerun it and paste when they change.
"""
import math
import sys

import numpy as np


def interpolate(points, degree=3):
    """Control points and the distinct knots with multiplicities of the clamped B-spline through the points."""
    p = np.array(points, dtype=float)
    n = len(p)
    d = np.r_[0.0, np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))]
    u = d / d[-1]
    inner = [np.mean(u[j:j + degree]) for j in range(1, n - degree)]
    knots = np.r_[[0.0] * (degree + 1), inner, [1.0] * (degree + 1)]

    def basis(i, k, t):
        if k == 0:
            last = t == 1.0 and knots[i] < 1.0 and knots[i + 1] == 1.0
            return 1.0 if (knots[i] <= t < knots[i + 1]) or last else 0.0
        a = 0.0 if knots[i + k] == knots[i] else (t - knots[i]) / (knots[i + k] - knots[i]) * basis(i, k - 1, t)
        b = 0.0 if knots[i + k + 1] == knots[i + 1] else (knots[i + k + 1] - t) / (knots[i + k + 1] - knots[i + 1]) * basis(i + 1, k - 1, t)
        return a + b

    a = np.array([[basis(i, degree, t) for i in range(n)] for t in u])
    control = np.linalg.solve(a, p)
    distinct, mults = [], []
    for k in knots:
        if distinct and abs(k - distinct[-1]) < 1e-12:
            mults[-1] += 1
        else:
            distinct.append(float(k))
            mults.append(1)
    return control, distinct, mults, a


def evaluate(control, knots_full, degree, t):
    """De Boor, for the deviation check."""
    k = np.searchsorted(knots_full, t, side="right") - 1
    k = min(max(k, degree), len(control) - 1)
    d = [control[j + k - degree].copy() for j in range(degree + 1)]
    for r in range(1, degree + 1):
        for j in range(degree, r - 1, -1):
            i = j + k - degree
            alpha = (t - knots_full[i]) / (knots_full[i + degree + 1 - r] - knots_full[i])
            d[j] = (1 - alpha) * d[j - 1] + alpha * d[j]
    return d[degree]


def main(argv):
    R, r, h, n = (float(argv[1]), float(argv[2]), float(argv[3]), int(argv[4])) if len(argv) > 4 else (1.0, 0.4, 3.0, 96)
    sides = []
    for side in (1.0, -1.0):
        pts = []
        for k in range(n + 1):
            t = 2 * math.pi * k / n
            y, z = r * math.cos(t), h / 2 + r * math.sin(t)
            pts.append((side * math.sqrt(R * R - y * y), y, z))
        pts[-1] = pts[0]
        control, knots, mults, _ = interpolate(pts)
        full = np.repeat(knots, mults)
        worst = 0.0
        for t in np.linspace(0, 1, 2000):
            x, y, z = evaluate(control, full, 3, t)
            worst = max(worst, abs(math.hypot(x, y) - R), abs(math.hypot(y, z - h / 2) - r))
        sides.append((side, control, knots, mults, worst))
    full = [k for k, m in zip(sides[0][2], sides[0][3]) for _ in range(m)]
    print(f"    // The clamped knot vector both curves share (R {R}, r {r}, h {h}, N {n}), every knot written out.")
    print("    CrossHoleKnots(_: Integer): Array<Number>")
    print("        => [" + ", ".join(f"{k:.12f}" for k in full) + "];")
    for side, control, knots, mults, worst in sides:
        name = "CrossHolePlusPoints" if side > 0 else "CrossHoleMinusPoints"
        print(f"    // The curve on the {'+' if side > 0 else '-'}x side; its farthest point lies {worst:.1e} off a cylinder.")
        print(f"    {name}(_: Integer): Array<Point3D>")
        print("        => [" + ",\n            ".join(f"Point3D({x:.12f}, {y:.12f}, {z:.12f})" for x, y, z in control) + "];")


if __name__ == "__main__":
    main(sys.argv)
