using System.Numerics;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace Ara3D.F8
{
    /// <summary>
    /// A SIMD "vector-of-Vector3" type: holds 8 Vector3s and performs operations lane-wise.
    /// Mirrors much of System.Numerics.Vector3 API, but each component is an f8 (8 floats).
    /// </summary>
    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public readonly struct Vector3x8 : IEquatable<Vector3x8>
    {
        public readonly f8 X;
        public readonly f8 Y;
        public readonly f8 Z;

        //-------------------------------------------------------------------------------------
        // Constructors
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public Vector3x8(f8 x, f8 y, f8 z)
        {
            X = x;
            Y = y;
            Z = z;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public Vector3x8(float x, float y, float z)
        {
            X = new f8(x);
            Y = new f8(y);
            Z = new f8(z);
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public Vector3x8(Vector3 v)
        {
            X = new f8(v.X);
            Y = new f8(v.Y);
            Z = new f8(v.Z);
        }

        /// <summary>Construct from 8 scalar Vector3s (one per lane).</summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public Vector3x8(
            Vector3 v0, Vector3 v1, Vector3 v2, Vector3 v3,
            Vector3 v4, Vector3 v5, Vector3 v6, Vector3 v7)
        {
            X = new f8(v0.X, v1.X, v2.X, v3.X, v4.X, v5.X, v6.X, v7.X);
            Y = new f8(v0.Y, v1.Y, v2.Y, v3.Y, v4.Y, v5.Y, v6.Y, v7.Y);
            Z = new f8(v0.Z, v1.Z, v2.Z, v3.Z, v4.Z, v5.Z, v6.Z, v7.Z);
        }

        //-------------------------------------------------------------------------------------
        // Loads / Stores
        //-------------------------------------------------------------------------------------

        /// <summary>Load from Structure-of-Arrays (SoA): x[i], y[i], z[i] for i in [0..7].</summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 LoadSoA(ReadOnlySpan<float> xs, ReadOnlySpan<float> ys, ReadOnlySpan<float> zs)
        {
            if (xs.Length < 8 || ys.Length < 8 || zs.Length < 8)
                throw new ArgumentException("Each input span must have at least 8 elements.");

            return new Vector3x8(
                new f8(xs[0], xs[1], xs[2], xs[3], xs[4], xs[5], xs[6], xs[7]),
                new f8(ys[0], ys[1], ys[2], ys[3], ys[4], ys[5], ys[6], ys[7]),
                new f8(zs[0], zs[1], zs[2], zs[3], zs[4], zs[5], zs[6], zs[7])
            );
        }

        /// <summary>Store to Structure-of-Arrays (SoA): x[i], y[i], z[i] for i in [0..7].</summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public void StoreSoA(Span<float> xs, Span<float> ys, Span<float> zs)
        {
            if (xs.Length < 8 || ys.Length < 8 || zs.Length < 8)
                throw new ArgumentException("Each output span must have at least 8 elements.");

            for (var i = 0; i < 8; i++)
            {
                xs[i] = X[i];
                ys[i] = Y[i];
                zs[i] = Z[i];
            }
        }

        /// <summary>
        /// Load from Array-of-Structs (AoS): 8 consecutive Vector3s starting at <paramref name="start"/>.
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 LoadAoS(ReadOnlySpan<Vector3> vectors, int start = 0)
        {
            if ((uint)start > (uint)vectors.Length) throw new ArgumentOutOfRangeException(nameof(start));
            if (vectors.Length - start < 8) throw new ArgumentException("Need at least 8 Vector3s from start.");

            // Fast ref-based access (no bounds checks inside loop in Release typically)
            ref readonly var r0 = ref vectors[start];
            var v0 = r0;
            var v1 = Unsafe.Add(ref Unsafe.AsRef(in r0), 1);
            var v2 = Unsafe.Add(ref Unsafe.AsRef(in r0), 2);
            var v3 = Unsafe.Add(ref Unsafe.AsRef(in r0), 3);
            var v4 = Unsafe.Add(ref Unsafe.AsRef(in r0), 4);
            var v5 = Unsafe.Add(ref Unsafe.AsRef(in r0), 5);
            var v6 = Unsafe.Add(ref Unsafe.AsRef(in r0), 6);
            var v7 = Unsafe.Add(ref Unsafe.AsRef(in r0), 7);

            return new Vector3x8(v0, v1, v2, v3, v4, v5, v6, v7);
        }

        /// <summary>
        /// Store to Array-of-Structs (AoS): writes 8 consecutive Vector3s starting at <paramref name="start"/>.
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public void StoreAoS(Span<Vector3> vectors, int start = 0)
        {
            if ((uint)start > (uint)vectors.Length) throw new ArgumentOutOfRangeException(nameof(start));
            if (vectors.Length - start < 8) throw new ArgumentException("Need space for 8 Vector3s from start.");

            ref var dst0 = ref vectors[start];
            Unsafe.Add(ref dst0, 0) = new Vector3(X[0], Y[0], Z[0]);
            Unsafe.Add(ref dst0, 1) = new Vector3(X[1], Y[1], Z[1]);
            Unsafe.Add(ref dst0, 2) = new Vector3(X[2], Y[2], Z[2]);
            Unsafe.Add(ref dst0, 3) = new Vector3(X[3], Y[3], Z[3]);
            Unsafe.Add(ref dst0, 4) = new Vector3(X[4], Y[4], Z[4]);
            Unsafe.Add(ref dst0, 5) = new Vector3(X[5], Y[5], Z[5]);
            Unsafe.Add(ref dst0, 6) = new Vector3(X[6], Y[6], Z[6]);
            Unsafe.Add(ref dst0, 7) = new Vector3(X[7], Y[7], Z[7]);
        }

        //-------------------------------------------------------------------------------------
        // Constants
        //-------------------------------------------------------------------------------------

        public static readonly Vector3x8 Zero = new(f8.Zero, f8.Zero, f8.Zero);
        public static readonly Vector3x8 One = new(f8.One, f8.One, f8.One);
        public static readonly Vector3x8 UnitX = new(f8.One, f8.Zero, f8.Zero);
        public static readonly Vector3x8 UnitY = new(f8.Zero, f8.One, f8.Zero);
        public static readonly Vector3x8 UnitZ = new(f8.Zero, f8.Zero, f8.One);

        //-------------------------------------------------------------------------------------
        // Lane access (get/set as scalar Vector3)
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public Vector3 GetLane(int lane)
        {
            if ((uint)lane >= 8) throw new ArgumentOutOfRangeException(nameof(lane));
            return new Vector3(X[lane], Y[lane], Z[lane]);
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public Vector3x8 WithLane(int lane, Vector3 v)
        {
            if ((uint)lane >= 8) throw new ArgumentOutOfRangeException(nameof(lane));
            return new Vector3x8(
                X.WithElement(lane, v.X),
                Y.WithElement(lane, v.Y),
                Z.WithElement(lane, v.Z));
        }

        //-------------------------------------------------------------------------------------
        // Conditional Select (mask lane-wise)
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 ConditionalSelect(f8 condition, Vector3x8 a, Vector3x8 b)
            => new(
                f8.ConditionalSelect(condition, a.X, b.X),
                f8.ConditionalSelect(condition, a.Y, b.Y),
                f8.ConditionalSelect(condition, a.Z, b.Z));

        //-------------------------------------------------------------------------------------
        // Operators
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 operator +(Vector3x8 a, Vector3x8 b)
            => new(a.X + b.X, a.Y + b.Y, a.Z + b.Z);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 operator -(Vector3x8 a, Vector3x8 b)
            => new(a.X - b.X, a.Y - b.Y, a.Z - b.Z);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 operator -(Vector3x8 v)
            => new(-v.X, -v.Y, -v.Z);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 operator *(Vector3x8 v, f8 s)
            => new(v.X * s, v.Y * s, v.Z * s);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 operator *(f8 s, Vector3x8 v)
            => new(v.X * s, v.Y * s, v.Z * s);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 operator *(Vector3x8 v, float s)
            => new(v.X * s, v.Y * s, v.Z * s);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 operator *(float s, Vector3x8 v)
            => new(v.X * s, v.Y * s, v.Z * s);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 operator /(Vector3x8 v, f8 s)
            => new(v.X / s, v.Y / s, v.Z / s);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 operator /(Vector3x8 v, float s)
            => new(v.X / s, v.Y / s, v.Z / s);

        /// <summary>Component-wise multiply.</summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 Multiply(Vector3x8 a, Vector3x8 b)
            => new(a.X * b.X, a.Y * b.Y, a.Z * b.Z);

        /// <summary>Component-wise divide.</summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 Divide(Vector3x8 a, Vector3x8 b)
            => new(a.X / b.X, a.Y / b.Y, a.Z / b.Z);

        //-------------------------------------------------------------------------------------
        // Common Vector3-like functions (lane-wise)
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 Dot(Vector3x8 a, Vector3x8 b)
            => (a.X * b.X) + (a.Y * b.Y) + (a.Z * b.Z);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 Cross(Vector3x8 a, Vector3x8 b)
            => new(
                (a.Y * b.Z) - (a.Z * b.Y),
                (a.Z * b.X) - (a.X * b.Z),
                (a.X * b.Y) - (a.Y * b.X));

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 Min(Vector3x8 a, Vector3x8 b)
            => new(f8.Min(a.X, b.X), f8.Min(a.Y, b.Y), f8.Min(a.Z, b.Z));

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 Max(Vector3x8 a, Vector3x8 b)
            => new(f8.Max(a.X, b.X), f8.Max(a.Y, b.Y), f8.Max(a.Z, b.Z));

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 Clamp(Vector3x8 value, Vector3x8 min, Vector3x8 max)
            => new(
                value.X.Clamp(min.X, max.X),
                value.Y.Clamp(min.Y, max.Y),
                value.Z.Clamp(min.Z, max.Z));

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 Lerp(Vector3x8 a, Vector3x8 b, f8 t)
            => new(f8.Lerp(a.X, b.X, t), f8.Lerp(a.Y, b.Y, t), f8.Lerp(a.Z, b.Z, t));

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8 LengthSquared()
            => (X * X) + (Y * Y) + (Z * Z);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8 Length()
            => LengthSquared().Sqrt();

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public Vector3x8 Normalize()
        {
            var invLen = Length().Reciprocal();
            return this * invLen;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 Normalize(Vector3x8 v) => v.Normalize();

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 Distance(Vector3x8 a, Vector3x8 b) => (a - b).Length();

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 DistanceSquared(Vector3x8 a, Vector3x8 b) => (a - b).LengthSquared();

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 Negate(Vector3x8 v) => -v;

        //-------------------------------------------------------------------------------------
        // Transform / TransformNormal (Matrix4x4)
        // System.Numerics uses:
        // X' = x*M11 + y*M21 + z*M31 + M41
        // Y' = x*M12 + y*M22 + z*M32 + M42
        // Z' = x*M13 + y*M23 + z*M33 + M43
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 Transform(Vector3x8 position, Matrix4x4 m)
        {
            var x = position.X;
            var y = position.Y;
            var z = position.Z;

            var rx = (x * m.M11) + (y * m.M21) + (z * m.M31) + m.M41;
            var ry = (x * m.M12) + (y * m.M22) + (z * m.M32) + m.M42;
            var rz = (x * m.M13) + (y * m.M23) + (z * m.M33) + m.M43;

            return new Vector3x8(rx, ry, rz);
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static Vector3x8 TransformNormal(Vector3x8 normal, Matrix4x4 m)
        {
            var x = normal.X;
            var y = normal.Y;
            var z = normal.Z;

            var rx = (x * m.M11) + (y * m.M21) + (z * m.M31);
            var ry = (x * m.M12) + (y * m.M22) + (z * m.M32);
            var rz = (x * m.M13) + (y * m.M23) + (z * m.M33);

            return new Vector3x8(rx, ry, rz);
        }

        //-------------------------------------------------------------------------------------
        // Comparisons (mask results per-lane, like f8 comparisons)
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 EqualsMask(Vector3x8 a, Vector3x8 b)
            => (a.X == b.X) & (a.Y == b.Y) & (a.Z == b.Z);

        /// <summary>
        /// Per-lane "nearly equals" using absolute tolerance.
        /// Returns an f8 mask (all-bits-set where true).
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 NearlyEquals(Vector3x8 a, Vector3x8 b, f8 epsilon)
        {
            var dx = (a.X - b.X).Abs() <= epsilon;
            var dy = (a.Y - b.Y).Abs() <= epsilon;
            var dz = (a.Z - b.Z).Abs() <= epsilon;
            return dx & dy & dz;
        }

        //-------------------------------------------------------------------------------------
        // Overrides / Equality
        //-------------------------------------------------------------------------------------

        public override string ToString()
            => $"X={X} Y={Y} Z={Z}";

        public bool Equals(Vector3x8 other)
            => X.Equals(other.X) && Y.Equals(other.Y) && Z.Equals(other.Z);

        public override bool Equals(object? obj)
            => obj is Vector3x8 v && Equals(v);

        public override int GetHashCode()
            => HashCode.Combine(X, Y, Z);
    }
}
