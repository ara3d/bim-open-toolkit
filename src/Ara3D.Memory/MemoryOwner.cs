using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.CompilerServices;

namespace Ara3D.Memory;

/// <summary>
/// Wrap an IMemoryOwner in a typed wrapper. 
/// </summary>
/// <typeparam name="T"></typeparam>
[SkipLocalsInit]
public unsafe class MemoryOwner<T> : IMemoryOwner<T>
    where T : unmanaged
{
    public IMemoryOwner Memory { get; private set; }
    public Buffer<T> Buffer { get; private set; }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public MemoryOwner(IMemoryOwner memory)
    {
        if (memory.Bytes.Length % sizeof(T) != 0)
            throw new Exception($"Cannot cast memory to type {typeof(T)}");

        Memory = memory;
        Buffer = new Buffer<T>(memory.Bytes);
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public void Dispose()
    {
        Memory?.Dispose();
        Memory = null;
        Buffer = null;
    }

    ~MemoryOwner()
    {
        Dispose();
    }

    public int Count
    {
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        get => Buffer.Count; 
    }

    public ref T this[int index]
    {
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        get => ref Buffer[index];
    }

    T IReadOnlyList<T>.this[int index]
    {
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        get => this[index];
    }

    public ByteSlice Bytes
    {
        [MethodImpl(MethodImplOptions.AggressiveInlining)] 
        get => Buffer.Bytes;
    }

    public Type Type
    {
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        get => Buffer.Type; 
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public IEnumerator<T> GetEnumerator()
        => Buffer.GetEnumerator();

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    IEnumerator IEnumerable.GetEnumerator()
        => ((IEnumerable)Buffer).GetEnumerator();

    public IMemoryOwner<T1> Convert<T1>()
        where T1 : unmanaged
    {
        var r = new MemoryOwner<T1>(Memory);
        Memory = null;
        Buffer = null;
        return r;
    }
}
