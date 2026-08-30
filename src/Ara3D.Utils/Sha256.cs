using System;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Runtime.Intrinsics;
using System.Security.Cryptography;

namespace Ara3D.Utils;

public readonly struct Sha256 : IEquatable<Sha256>
{
    public readonly Vector256<byte> Value;

    public const int ByteSize = 32;
    public const int HexLength = 64;

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public Sha256(Vector256<byte> value) => Value = value;

    public static Sha256 Compute(ReadOnlySpan<byte> data)
    {
        Span<byte> hash = stackalloc byte[ByteSize];
        SHA256.HashData(data, hash);
        return FromBytes(hash);
    }

    public static Sha256 FromBytes(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length != ByteSize)
            throw new ArgumentException($"SHA256 must be {ByteSize} bytes.");
        return new Sha256(MemoryMarshal.Read<Vector256<byte>>(bytes));
    }

    public static Sha256 FromHex(ReadOnlySpan<char> hex)
    {
        if (hex.Length != HexLength)
            throw new FormatException($"SHA256 hex must be {HexLength} characters.");
        Span<byte> bytes = stackalloc byte[ByteSize];
        Convert.FromHexString(hex);
        return FromBytes(bytes);
    }

    public ReadOnlySpan<byte> AsBytes()
        => MemoryMarshal.AsBytes(MemoryMarshal.CreateReadOnlySpan(ref Unsafe.AsRef(in Value), 1));

    public string ToHex(bool upperCase = false)
        => upperCase
            ? Convert.ToHexString(AsBytes())
            : Convert.ToHexString(AsBytes()).ToLowerInvariant();

    public string ToShortHex(int length = 7)
    {
        if (length <= 0 || length > HexLength)
            throw new ArgumentOutOfRangeException(nameof(length));
        Span<char> chars = stackalloc char[length];
        Convert.ToHexString(AsBytes()).AsSpan(0, length)
            .ToLowerInvariant(chars);
        return new string(chars);
    }

    public static Sha256 CreateRandom()
    {
        Span<byte> bytes = stackalloc byte[Sha256.ByteSize];
        RandomNumberGenerator.Fill(bytes);
        return Sha256.FromBytes(bytes);
    }

    public override string ToString() => ToHex(false);
    public bool Equals(Sha256 other) => Value.Equals(other.Value);
    public override bool Equals(object? obj) => obj is Sha256 other && Equals(other);
    public override int GetHashCode() => Value.GetHashCode();
    public static bool operator ==(Sha256 a, Sha256 b) => a.Equals(b);
    public static bool operator !=(Sha256 a, Sha256 b) => !a.Equals(b);
}