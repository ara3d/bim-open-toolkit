using System;
using System.Collections.Generic;
using System.Text;

namespace Ara3D.IO.StepParser;


public unsafe class StepHeader
{
    public string FileDescription { get; set; }
    public string FileName { get; set; }
    public string FileSchema { get; set; }

    // --- Header parsing ---

    public static StepHeader Parse(ref byte* ptr, byte* dataEnd)
    {
        var r = new StepHeader();

        // STEP file preamble + header section
        _assertStatementEquals(ref ptr, dataEnd, "ISO-10303-21");
        _assertStatementEquals(ref ptr, dataEnd, "HEADER");

        while (true)
        {
            var stmt = _parseStatement(ref ptr, dataEnd);
            if (stmt == null)
                throw new Exception("Unexpected EOF while parsing HEADER (missing ENDSEC).");

            if (stmt.StartsWith("ENDSEC", StringComparison.OrdinalIgnoreCase))
                break;

            // Ignore empty/noise statements defensively
            if (stmt.Length == 0)
                continue;

            if (stmt.StartsWith("FILE_DESCRIPTION", StringComparison.OrdinalIgnoreCase))
            {
                // Typical: FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1')
                // We'll store the description strings joined.
                var quoted = _extractQuotedStrings(stmt);
                r.FileDescription = quoted.Count == 0 ? stmt : string.Join(" | ", quoted);
            }
            else if (stmt.StartsWith("FILE_NAME", StringComparison.OrdinalIgnoreCase))
            {
                // Typical: FILE_NAME('name.ifc','2024-..',('author'),('org'),'preproc','system','auth')
                // We'll store the first quoted string if present (file name), otherwise the raw stmt.
                var quoted = _extractQuotedStrings(stmt);
                r.FileName = quoted.Count == 0 ? stmt : quoted[0];
            }
            else if (stmt.StartsWith("FILE_SCHEMA", StringComparison.OrdinalIgnoreCase))
            {
                // Typical: FILE_SCHEMA(('IFC4')) or FILE_SCHEMA(('IFC4X3_ADD2'))
                // We'll store the first schema token and normalize to IFC2X3 / IFC4 / IFC4X3 if possible.
                var quoted = _extractQuotedStrings(stmt);
                var rawSchema = quoted.Count == 0 ? "" : quoted[0];
                r.FileSchema = _normalizeIfcSchemaToken(rawSchema);
                if (string.IsNullOrWhiteSpace(r.FileSchema))
                    r.FileSchema = stmt; // fall back to raw
            }

            // else: ignore other header statements (e.g., FILE_POPULATION, etc.)
        }

        // After ENDSEC; typically comes DATA; but we just return the pointer at current position
        return r;
    }

    private static void _assertStatementEquals(ref byte* ptr, byte* dataEnd, string expected)
    {
        var stmt = _parseStatement(ref ptr, dataEnd);
        if (stmt == null)
            throw new Exception($"Unexpected EOF; expected '{expected}'.");

        if (!string.Equals(stmt, expected, StringComparison.OrdinalIgnoreCase))
            throw new Exception($"Expected '{expected}' but was '{stmt}'.");
    }

    /// <summary>
    /// Parses the next STEP statement (terminated by ';') as ASCII text, trimming whitespace.
    /// Returns null on EOF (no more non-whitespace).
    /// </summary>
    private static string _parseStatement(ref byte* ptr, byte* dataEnd)
    {
        // Skip UTF-8 BOM if present at start
        if (*ptr == 0xEF && *(ptr + 1) == 0xBB && *(ptr + 2) == 0xBF)
            ptr += 3;

        // Skip whitespace/newlines
        while (ptr < dataEnd)
        {
            var b = *ptr;
            if (b == (byte)' ' || b == (byte)'\t' || b == (byte)'\r' || b == (byte)'\n')
                ptr++;
            else
                break;
        }

        if (ptr >= dataEnd)
            return null;

        // Read until ';' (STEP statement terminator)
        var start = ptr;
        while (ptr < dataEnd && *ptr != (byte)';')
            ptr++;

        if (ptr >= dataEnd)
            throw new Exception("Unexpected EOF while reading STEP statement (missing ';').");

        var end = ptr;      // points at ';'
        ptr++;              // consume ';'

        // Trim trailing whitespace inside statement region
        while (end > start)
        {
            var b = *(end - 1);
            if (b == (byte)' ' || b == (byte)'\t' || b == (byte)'\r' || b == (byte)'\n')
                end--;
            else
                break;
        }

        // Convert [start, end) to string (ASCII)
        var len = (int)(end - start);
        return len <= 0 ? "" : Encoding.ASCII.GetString(start, len);
    }

    // --- Small helper parsers ---

    /// <summary>
    /// Extracts all STEP single-quoted strings from a statement.
    /// Handles doubled quotes inside strings: '' -> '.
    /// Example: "ABC''DEF" becomes "ABC'DEF".
    /// </summary>
    private static List<string> _extractQuotedStrings(string stmt)
    {
        var r = new List<string>(8);
        var i = 0;
        while (i < stmt.Length)
        {
            if (stmt[i] != '\'')
            {
                i++;
                continue;
            }

            i++; // skip opening quote
            var sb = new System.Text.StringBuilder();

            while (i < stmt.Length)
            {
                var c = stmt[i];
                if (c == '\'')
                {
                    // Escaped quote: ''
                    if (i + 1 < stmt.Length && stmt[i + 1] == '\'')
                    {
                        sb.Append('\'');
                        i += 2;
                        continue;
                    }

                    // End of string
                    i++;
                    break;
                }

                sb.Append(c);
                i++;
            }

            r.Add(sb.ToString());
        }

        return r;
    }

    /// <summary>
    /// Normalizes typical IFC schema tokens to IFC2X3 / IFC4 / IFC4X3 where possible.
    /// Keeps unknown tokens as-is (trimmed).
    /// Examples:
    ///  - IFC2X3 -> IFC2X3
    ///  - IFC4X3_ADD2 -> IFC4X3
    ///  - IFC4 -> IFC4
    /// </summary>
    private static string _normalizeIfcSchemaToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return "";

        var t = token.Trim();

        // Common variants / extensions
        // IFC4X3_* should map to IFC4X3 for your enum use-case
        if (t.StartsWith("IFC4X3", StringComparison.OrdinalIgnoreCase))
            return "IFC4X3";

        if (t.StartsWith("IFC2X3", StringComparison.OrdinalIgnoreCase))
            return "IFC2X3";

        if (t.StartsWith("IFC4", StringComparison.OrdinalIgnoreCase))
            return "IFC4";

        return t;
    }
}