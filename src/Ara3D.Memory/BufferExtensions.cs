using System;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace Ara3D.Memory
{
    /// <summary>
    /// Helper functions for working with buffers 
    /// </summary>
    public static unsafe class BufferExtensions
    {
        public static long NumBytes(this IBuffer buffer)
            => buffer.Bytes.Length;

        public static byte* GetPointer(this IBuffer buffer)
            => buffer.Bytes.Begin;

        public static T* GetPointer<T>(this IBuffer<T> buffer) where T : unmanaged
            => buffer.Bytes.GetPointer<T>();

        public static Span<T> AsSpan<T>(this IBuffer<T> buffer) where T : unmanaged
            => buffer.Bytes.AsSpan<T>();

        public static ReadOnlySpan<T> AsReadOnlySpan<T>(this IBuffer<T> buffer) where T : unmanaged
            => buffer.AsSpan();

        public static T* GetPointer<T>(this IBuffer buffer) where T: unmanaged
            => buffer.Bytes.GetPointer<T>();

        public static Buffer<byte> ToBuffer(this ByteSlice self)
            => new(self);

        public static Buffer<T> ToBuffer<T>(this ByteSlice self)
            where T : unmanaged
            => new(self);

        public static Buffer<T> Reinterpret<T>(this IBuffer xs) where T : unmanaged
            => new(xs.Bytes);

        public static Buffer<T> Slice<T>(this IBuffer<T> xs, long start, long count) where T : unmanaged
            => xs.Bytes.Slice(start * Marshal.SizeOf<T>(), count * Marshal.SizeOf<T>()).ToBuffer<T>();

        public static Buffer<T> Skip<T>(this IBuffer<T> xs, long start) where T : unmanaged
            => xs.Slice(start, xs.Count - start);

        public static Buffer<T> Take<T>(this IBuffer<T> xs, long count) where T : unmanaged
            => xs.Slice(0, count);

        public static FixedArray<T> Fix<T>(this T[] self) where T : unmanaged
            => new(self);

        public static Buffer<T1> Reinterpret<T0, T1>(this IBuffer<T0> self) where T0 : unmanaged where T1 : unmanaged
            => new(self.Bytes);

        public static long ElementSize(this IBuffer buffer) 
            => Marshal.SizeOf(buffer.ElementType());

        public static long ElementCount(this IBuffer buffer)
            => buffer.Bytes.Count / buffer.ElementSize();

        public static IntPtr ElementPointer(this IBuffer buffer, long n)
            => new(buffer.GetPointer() + n * buffer.ElementSize());

        public static Type ElementType(this IBuffer buffer)
            => buffer is ITypedBuffer typedBuffer ? typedBuffer.Type : typeof(byte); 

        public static object GetElement(this IBuffer buffer, long n)
            => Marshal.PtrToStructure(buffer.ElementPointer(n), buffer.ElementType());

        public static T* Begin<T>(this IBuffer<T> buffer) where T : unmanaged
            => (T*)Unsafe.AsPointer(ref buffer[0]);

        public static T* End<T>(this IBuffer<T> buffer) where T : unmanaged
            => (T*)Unsafe.AsPointer(ref buffer[0]) + buffer.Count;

    }
}
