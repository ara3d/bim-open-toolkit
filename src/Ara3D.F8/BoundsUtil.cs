using System.Numerics;
using System.Runtime.CompilerServices;

namespace Ara3D.F8
{
    public static class BoundsUtil
    {
        public static Vector3 MinVector3 = new(float.MinValue, float.MinValue, float.MinValue);
        public static Vector3 MaxVector3 = new(float.MaxValue, float.MaxValue, float.MaxValue);
        public static (Vector3, Vector3) DefaultBounds = (MaxVector3, MinVector3);

        /// <summary>
        /// Compute bounds as fast as possible using f8/Vector3x8 (AVX/SSE reduction).
        /// Assumes inputs do not contain NaNs. (If they might, we can add a NaN-filter path.)
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static (Vector3 Min, Vector3 Max) ComputeBounds(this ReadOnlySpan<Vector3> points)
        {
            if (points.Length == 0)
                return DefaultBounds;

            var n = points.Length;
            int i;

            // Scalar tail accumulators (also used when n < 8)

            // Vector accumulators (only meaningful if we process at least one 8-wide block)
            var hasVec = false;
            f8 minX = default, minY = default, minZ = default;
            f8 maxX = default, maxY = default, maxZ = default;

            // Initialize from first element (cheap and avoids +inf/-inf setup cost)
            var sMin = points[0];
            var sMax = points[0];

            // If we have at least 8 points, initialize vector accumulators from first block.
            if (n >= 8)
            {
                var v = Vector3x8.LoadAoS(points, 0);
                minX = v.X; minY = v.Y; minZ = v.Z;
                maxX = v.X; maxY = v.Y; maxZ = v.Z;
                hasVec = true;
                i = 8;
            }
            else
            {
                // Small case: just scalar scan.
                i = 1;
            }

            // Vectorized main loop
            for (; i + 7 < n; i += 8)
            {
                var v = Vector3x8.LoadAoS(points, i);

                // Per-component min/max
                minX = f8.Min(minX, v.X);
                minY = f8.Min(minY, v.Y);
                minZ = f8.Min(minZ, v.Z);

                maxX = f8.Max(maxX, v.X);
                maxY = f8.Max(maxY, v.Y);
                maxZ = f8.Max(maxZ, v.Z);
            }

            // Scalar tail
            for (; i < n; i++)
            {
                var p = points[i];
                sMin = Vector3.Min(sMin, p);
                sMax = Vector3.Max(sMax, p);
            }

            // Reduce vector accumulators into scalar, then combine with scalar tail
            if (hasVec)
            {
                var vMin = new Vector3(
                    minX.MinComponent(),
                    minY.MinComponent(),
                    minZ.MinComponent());

                var vMax = new Vector3(
                    maxX.MaxComponent(),
                    maxY.MaxComponent(),
                    maxZ.MaxComponent());

                sMin = Vector3.Min(sMin, vMin);
                sMax = Vector3.Max(sMax, vMax);
            }

            return (sMin, sMax);
        }
    }
}
