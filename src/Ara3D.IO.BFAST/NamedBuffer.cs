using System;
using System.Collections;
using System.Collections.Generic;
using Ara3D.Memory;

namespace Ara3D.IO.BFAST;

public class NamedBuffer(string name, IBuffer buffer)
    : IBuffer
{
    public string Name = name;
    public IBuffer Buffer = buffer;
    public ByteSlice Bytes => Buffer.Bytes;
}

public class TypedNamedBuffer(string name, ITypedBuffer buffer)
    : NamedBuffer(name, buffer), ITypedBuffer
{
    public new ITypedBuffer Buffer = buffer;
    public Type Type => Buffer.GetType();
}

public class NamedBuffer<T>(string name, IBuffer<T> buffer)
    : TypedNamedBuffer(name, buffer), IBuffer<T>
    where T : unmanaged
{
    public ref T this[int i] => ref Buffer[i];
    T IReadOnlyList<T>.this[int index] => ((IReadOnlyList<T>)Buffer)[index];
    public new IBuffer<T> Buffer = buffer;
    public Type Type => Buffer.Type;
    public int Count => Buffer.Count;
    public IEnumerator<T> GetEnumerator() => Buffer.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => ((IEnumerable)Buffer).GetEnumerator();
}


public static class NamedBufferExtensions
{
    public static NamedBuffer<T> Rename<T>(this NamedBuffer<T> xs, string name) where T : unmanaged
        => new(name, xs.Buffer);

    public static NamedBuffer Rename(this NamedBuffer xs, string name)
        => new(name, xs.Buffer);

    public static NamedBuffer ToNamedBuffer(this IBuffer buffer, string name = "")
        => new(name, buffer);

    public static NamedBuffer<T> ToNamedBuffer<T>(this IBuffer<T> buffer, string name = "") where T : unmanaged
        => new(name, buffer);

    public static NamedBuffer<T> ToNamedBuffer<T>(this IBuffer buffer, string name = "") where T : unmanaged
        => new(name, buffer.Reinterpret<T>());

    public static NamedBuffer<T> ToNamedBuffer<T>(this T[] xs, string name = "") where T : unmanaged
        => xs.Fix().ToNamedBuffer(name);
}