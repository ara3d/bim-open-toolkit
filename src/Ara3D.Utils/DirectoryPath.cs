using System;
using System.IO;

namespace Ara3D.Utils
{
    /// <summary>
    /// Wraps a string used to represent a path to a directory.
    /// Implicitly casts to and from strings as needed. See PathUtil
    /// for a number of useful functions.
    /// </summary>
    public readonly struct DirectoryPath : IEquatable<DirectoryPath>
    {
        public string Value { get; }
        public string FullPath { get; }

        public DirectoryPath(string path)
        {
            Value = path;
            FullPath = string.IsNullOrEmpty(path) ? "" : Path.GetFullPath(path);
        }

        public override string ToString() => Value;
        public static implicit operator string(DirectoryPath path) => path.Value ?? "";
        public static implicit operator DirectoryPath(string path) => new(path);
        public override bool Equals(object obj) => obj is DirectoryPath dp && Equals(dp);
        public bool Equals(DirectoryPath dp) => StringComparer.OrdinalIgnoreCase.Equals(FullPath, dp.FullPath);
        public override int GetHashCode() => StringComparer.OrdinalIgnoreCase.GetHashCode(FullPath);
    }
}