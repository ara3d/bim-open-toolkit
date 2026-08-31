using System;
using System.IO;
using System.Security.Cryptography;

namespace Ara3D.DataFlowEngine.Runs;

/// <summary>Content hashing for external inputs: bare lowercase hex SHA-256,
/// the one hash style used throughout the spec.</summary>
public static class Hashes
{
    public static string HashFile(string path)
    {
        using var stream = File.OpenRead(path);
        return ToHex(SHA256.HashData(stream));
    }

    public static string HashBytes(ReadOnlySpan<byte> bytes)
        => ToHex(SHA256.HashData(bytes));

    public static bool IsHash(string text)
    {
        if (text.Length != 64)
            return false;
        foreach (var c in text)
            if (c is not (>= '0' and <= '9' or >= 'a' and <= 'f'))
                return false;
        return true;
    }

    private static string ToHex(byte[] hash)
        => Convert.ToHexString(hash).ToLowerInvariant();
}
