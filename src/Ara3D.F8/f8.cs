using System.Runtime.CompilerServices;
using System.Runtime.Intrinsics;
using System.Runtime.Intrinsics.X86;
using System.Runtime.InteropServices;

namespace Ara3D.F8
{
    /// <summary>
    /// SIMD types can provide up to and beyond 8x improvements over traditional operations involving floats, by using extra wide
    /// registers on the system, and providing special opcodes for operating on them.
    ///
    /// A specific set of opcodes that can operate on 8 floats at a time known as AVX (Advanced Vector Extensions) is 
    /// widely available on the CPUs of most modern laptop and desktop computers. 
    /// https://en.wikipedia.org/wiki/Advanced_Vector_Extensions#CPUs_with_AVX
    ///  
    /// Working with SIMD types and intrinsics C# however can be quite confusing for the uninitiated.
    /// There are over a thousand intrinsic opcodes, and many are poorly documented, and scattered across dozens of classes. 
    /// ChatGPT is unaware of recent introductions of utility functions .NET 9 that make working with SIMD types much easier.
    ///
    /// This class provides a wrapper around the Vector256&lt;float&gt; type and provides many of the basic math operations
    /// </summary>
    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public readonly struct f8
    {
        public readonly Vector256<float> Value;

        //-------------------------------------------------------------------------------------
        // Constructors
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8(Vector256<float> value) => Value = value;

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8(float scalar) => Value = Vector256.Create(scalar);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8(float f0, float f1, float f2, float f3, float f4, float f5, float f6, float f7)
            => Value = Vector256.Create(f0, f1, f2, f3, f4, f5, f6, f7);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8(Vector128<float> upper, Vector128<float> lower) => Value = Vector256.Create(lower, upper);

        //-------------------------------------------------------------------------------------
        // Implicit operators 
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static implicit operator Vector256<float>(f8 value) => value.Value;

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static implicit operator f8(Vector256<float> value) => new(value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static implicit operator f8(float value) => new(value);

        //-------------------------------------------------------------------------------------
        // Constants
        //-------------------------------------------------------------------------------------

        public static f8 Zero = new(0);
        public static f8 One = new(1);
        public static f8 AllBitsSet = new(Vector256<float>.AllBitsSet);
        public static f8 SignMask = Vector256.Create(0x80000000u).AsSingle();

        //-------------------------------------------------------------------------------------
        // Indexer
        //-------------------------------------------------------------------------------------

        public float this[int index]
        {
            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            get => Value.GetElement(index);
        }

        public int Count
        {
            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            get => 8;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public float GetElement(int index) => Value.GetElement(index);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public Vector128<float> GetLower() => Value.GetLower();

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public Vector128<float> GetUpper() => Value.GetUpper();

        //-------------------------------------------------------------------------------------
        // Operator Overloads
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator +(f8 left, f8 right) => Vector256.Add(left.Value, right.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator -(f8 left, f8 right) => Vector256.Subtract(left.Value, right.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator *(f8 left, f8 right) => Vector256.Multiply(left.Value, right.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator *(f8 left, float scalar) => Vector256.Multiply(left.Value, scalar);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator *(float scalar, f8 right) => Vector256.Multiply(scalar, right.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator /(f8 left, f8 right) => Vector256.Divide(left.Value, right.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator /(f8 left, float scalar) => Vector256.Divide(left.Value, scalar);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator /(float scalar, f8 right) => Vector256.Divide(new f8(scalar), right.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator -(f8 value) => Vector256.Negate(value.Value);

        //-------------------------------------------------------------------------------------
        // Bitwise functions
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 AndNot(f8 a, f8 b) => Vector256.AndNot(a.Value, b.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator &(f8 a, f8 b) => Vector256.BitwiseAnd(a.Value, b.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator |(f8 a, f8 b) => Vector256.BitwiseOr(a.Value, b.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator ~(f8 a) => Vector256.OnesComplement(a.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator^(f8 a, f8 b) => Vector256.Xor(a.Value, b.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 ConditionalSelect(f8 condition, f8 a, f8 b) => Vector256.ConditionalSelect(condition.Value, a.Value, b.Value);

        //-------------------------------------------------------------------------------------
        // Comparison operators 
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator==(f8 a, f8 b) => Vector256.Equals(a.Value, b.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator!=(f8 a, f8 b) => ~Vector256.Equals(a.Value, b.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator<(f8 a, f8 b) => Vector256.LessThan(a.Value, b.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator<=(f8 a, f8 b) => Vector256.LessThanOrEqual(a.Value, b.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator>(f8 a, f8 b) => Vector256.GreaterThan(a.Value, b.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 operator>=(f8 a, f8 b) => Vector256.GreaterThanOrEqual(a.Value, b.Value);

        //-------------------------------------------------------------------------------------
        // Comparison functions
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 Max(f8 a, f8 b) => Vector256.Max(a.Value, b.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 Min(f8 a, f8 b) => Vector256.Min(a.Value, b.Value);

        //-------------------------------------------------------------------------------------
        // Basic math functions 
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8 Abs() => Vector256.Abs(Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8 Ceiling() => Vector256.Ceiling(Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static float Dot(f8 a, f8 b) => Vector256.Dot(a.Value, b.Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8 Floor() => Vector256.Floor(Value);

        /// <summary>Reciprocal (1/x) of each element</summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8 Reciprocal() => Avx.Reciprocal(Value);

        /// <summary>Approximate reciprocal of the square root of each element: 1 / sqrt(x)</summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8 ReciprocalSqrt() => Avx.ReciprocalSqrt(Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8 Sqrt() => Vector256.Sqrt(Value);

        /// <summary>Square each element</summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8 Square() => this * this;

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public float Sum() => Vector256.Sum(Value);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public float FirstElement() => Vector256.ToScalar(Value);

        //-------------------------------------------------------------------------------------
        // Pseudo-mutation operators 
        //-------------------------------------------------------------------------------------

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8 WithElement(int i, float f) => Vector256.WithElement(this, i, f);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8 WithLower(Vector128<float> lower) => Vector256.WithLower(this, lower);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8 WithUpper(Vector128<float> upper) => Vector256.WithUpper(this, upper);

        //-------------------------------------------------------------------------------------
        // Overrides
        //-------------------------------------------------------------------------------------

        public override string ToString()
            => $"[{this[0]}, {this[1]}, {this[2]}, {this[3]}, {this[4]}, {this[5]}, {this[6]}, {this[7]}]";

        public override bool Equals(object? obj)
            => obj is f8 other && Vector256.EqualsAll(Value, other.Value);

        public override int GetHashCode()
        {
            // Combine hash codes from each element
            var hash = 17;
            for (var i = 0; i < 8; i++) 
                hash = hash * 31 + this[i].GetHashCode();
            return hash;
        }

        //----------------------

        /// <summary>
        /// Horizontal min across 8 lanes (AVX -> SSE -> scalar).
        /// Requires SSE (and f8 implies AVX usage anyway). Falls back to scalar if needed.
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public float MinComponent()
        {
            var a = Value;
            var lo = a.GetLower();
            var hi = a.GetUpper();

            // min across 8 -> 4
            var m = Sse.Min(lo, hi);

            // reduce 4 -> 2
            // swap (0,1) with (2,3): control = 0b11_10_01_00
            var shuf = Sse.Shuffle(m, m, 0b11_10_01_00);
            m = Sse.Min(m, shuf);

            // reduce 2 -> 1: move high pair into low
            shuf = Sse.MoveHighToLow(m, m);
            m = Sse.Min(m, shuf);

            return m.ToScalar();
        }

        /// <summary>
        /// Horizontal max across 8 lanes (AVX -> SSE -> scalar).
        /// Requires SSE. Falls back to scalar if needed.
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public float MaxComponent()
        {
            var a = Value;
            var lo = a.GetLower();
            var hi = a.GetUpper();

            var m = Sse.Max(lo, hi);

            var shuf = Sse.Shuffle(m, m, 0b11_10_01_00);
            m = Sse.Max(m, shuf);

            shuf = Sse.MoveHighToLow(m, m);
            m = Sse.Max(m, shuf);

            return m.ToScalar();
        }

        /// <summary>
        /// Clamp each lane to the inclusive range [min, max].
        /// Equivalent to: max(min, min(value, max)).
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public f8 Clamp(f8 min, f8 max)
        {
            // value <= max ? value : max
            var t = Vector256.Min(Value, max.Value);
            // t >= min ? t : min
            return Vector256.Max(t, min.Value);
        }

        /// <summary>
        /// Linearly interpolates between a and b by t (per lane).
        /// Equivalent to: a + (b - a) * t
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 Lerp(f8 a, f8 b, f8 t)
            => MultiplyAdd(b - a, t, a);

        /// <summary>
        /// Linearly interpolates between a and b by scalar t.
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 Lerp(f8 a, f8 b, float t)
            => a + (b - a) * t;

        /// <summary>
        /// Computes (a * b) + c per lane.
        /// Uses hardware FMA (fused multiply-add) when available; otherwise falls back to mul+add.
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 MultiplyAdd(f8 a, f8 b, f8 c) 
            => Fma.IsSupported ? new f8(Fma.MultiplyAdd(a, b, c)) : a * b + c;

        /// <summary>
        /// Computes (a * b) - c per lane.
        /// Uses FMA when available; otherwise falls back to mul-sub.
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 MultiplySubtract(f8 a, f8 b, f8 c)
            => Fma.IsSupported ? Fma.MultiplySubtract(a, b, c) : a * b - c;

        /// <summary>
        /// Computes -(a * b) + c per lane.
        /// Uses FMA when available; otherwise falls back to neg(mul)+add.
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 NegatedMultiplyAdd(f8 a, f8 b, f8 c)
            =>  Fma.IsSupported ? Fma.MultiplyAddNegated(a, b, c) : -(a * b) + c;

        /// <summary>
        /// Computes -(a * b) - c per lane.
        /// Uses FMA when available; otherwise falls back to neg(mul)-sub.
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static f8 NegatedMultiplySubtract(f8 a, f8 b, f8 c)
            => Fma.IsSupported ? Fma.MultiplySubtractNegated(a, b, c) : -(a * b) - c; 
    }
}