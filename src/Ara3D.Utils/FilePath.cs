using System;
using System.IO;

namespace Ara3D.Utils
{
    /// <summary>
    /// Wraps a string used to represent a path to a directory.
    /// Implicitly casts to and from strings as needed. See PathUtil
    /// for a number of useful functions.
    /// </summary>
    public readonly struct FilePath : IEquatable<FilePath>
    {
        public string Value { get; }
        public string FullPath { get; }

        public FilePath(string path)
        {
            Value = path;
            FullPath = string.IsNullOrEmpty(path) ? "" : Path.GetFullPath(path);
        }

        public override string ToString() => Value;
        public static implicit operator string(FilePath path) => path.Value ?? "";
        public static implicit operator FilePath(string path) => new(path);
        public override bool Equals(object obj) => obj is FilePath fp && Equals(fp);
        public bool Equals(FilePath fp) => StringComparer.OrdinalIgnoreCase.Equals(FullPath, fp.FullPath);
        public override int GetHashCode() => StringComparer.OrdinalIgnoreCase.GetHashCode(FullPath);
    }
}