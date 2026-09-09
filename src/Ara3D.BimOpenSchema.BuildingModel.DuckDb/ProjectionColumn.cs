using System.Collections;
using System.Globalization;
using System.Collections.Immutable;
using System.Reflection;
using DuckDB.NET.Data;
using Platonic;

namespace Ara3D.BimOpenSchema.BuildingModel.DuckDb;

/// <summary>Maps domain values to typed SQL columns without discarding fact provenance.</summary>
[Impure]
internal sealed record ProjectionColumn(string Name, Type Type, Func<object?, object?> Read)
{
    internal static ProjectionColumn[] ForRecord(Type type)
        => type.GetProperties(BindingFlags.Instance | BindingFlags.Public)
            .SelectMany(property => Expand(CoreSchema.ColumnName(property.Name), property.PropertyType,
                row => row is null ? null : property.GetValue(row))).ToArray();

    private static IEnumerable<ProjectionColumn> Expand(string name, Type type, Func<object?, object?> read)
    {
        type = Nullable.GetUnderlyingType(type) ?? type;
        if (IsGeneric(type, typeof(Fact<>)))
        {
            foreach (var column in Expand(name, type.GetGenericArguments()[0], row => Property(read(row), "Value")))
                yield return column;
            yield return new(name + "_assurance", typeof(string), row => Property(read(row), "Assurance")?.ToString());
            yield return new(name + "_reason", typeof(string), row => Property(read(row), "Reason")?.ToString());
            yield return new(name + "_explanation", typeof(string), row => Property(read(row), "Explanation"));
            yield return new(name + "_evidence", typeof(ImmutableArray<ReferenceKey<Evidence>>), row => Property(read(row), "Evidence"));
        }
        else if (IsGeneric(type, typeof(LinkSet<>)))
        {
            yield return new(name, typeof(ImmutableArray<>).MakeGenericType(typeof(SnapshotKey<>).MakeGenericType(type.GetGenericArguments()[0])),
                row => Property(read(row), "Items"));
            yield return new(name + "_completeness", typeof(string), row => Property(read(row), "Completeness")?.ToString());
            yield return new(name + "_evidence", typeof(ImmutableArray<ReferenceKey<Evidence>>), row => Property(read(row), "Evidence"));
        }
        else if (type == typeof(PropertyValue))
        {
            yield return new(name + "_kind", typeof(string), row => read(row)?.GetType().Name);
            foreach (var variant in type.GetNestedTypes(BindingFlags.Public))
            {
                var property = variant.GetProperty("Value")!;
                foreach (var column in Expand(name + "_" + CoreSchema.ColumnName(variant.Name), property.PropertyType,
                             row => read(row) is { } value && variant.IsInstanceOfType(value) ? property.GetValue(value) : null))
                    yield return column;
            }
        }
        else if (IsKey(type) || ScalarType(type) is not null || IsGeneric(type, typeof(ImmutableArray<>)))
            yield return new(name, type, read);
        else
        {
            var properties = type.GetProperties(BindingFlags.Instance | BindingFlags.Public);
            // Canonical unit wrappers expose one scalar; keep the domain column name.
            var unwrap = type.IsValueType && properties.Length == 1;
            foreach (var property in properties)
                foreach (var column in Expand(unwrap ? name : name + "_" + CoreSchema.ColumnName(property.Name), property.PropertyType,
                             row => read(row) is { } value ? property.GetValue(value) : null))
                    yield return column;
            if (properties.Length == 0) throw new NotSupportedException($"Unsupported projection type: {type}");
        }
    }

    internal string SqlType => TypeSql(Type);

    private static string TypeSql(Type type)
    {
        if (IsKey(type)) return "VARCHAR";
        if (ScalarType(type) is { } scalar) return scalar;
        if (IsGeneric(type, typeof(ImmutableArray<>))) return TypeSql(type.GetGenericArguments()[0]) + "[]";
        return "STRUCT(" + string.Join(", ", ForRecord(type).Select(column => $"{Quote(column.Name)} {column.SqlType}")) + ")";
    }

    internal string Parameter(DuckDBCommand command, object? row) => Bind(command, Type, Read(row));

    private static string Bind(DuckDBCommand command, Type type, object? value)
    {
        if (value is not null && IsGeneric(type, typeof(ImmutableArray<>)))
        {
            var elementType = type.GetGenericArguments()[0];
            return "CAST([" + string.Join(", ", ((IEnumerable)value).Cast<object>().Select(item => Bind(command, elementType, item))) + "] AS " + TypeSql(type) + ")";
        }
        if (value is not null && !IsKey(type) && ScalarType(type) is null)
            return "struct_pack(" + string.Join(", ", ForRecord(type).Select(column => Quote(column.Name) + " := " + column.Parameter(command, value))) + ")";
        // Positional parameters: the provider resolves named ones by scanning, which dominates large batches.
        command.Parameters.Add(new DuckDBParameter(value is null ? DBNull.Value :
            IsKey(type) || type.IsEnum ? value.ToString()! :
            value is DateTimeOffset timestamp ? timestamp.ToString("O", CultureInfo.InvariantCulture) :
            value is DateOnly date ? date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : value));
        return "?";
    }

    private static string? ScalarType(Type type)
        => type == typeof(string) || type.IsEnum ? "VARCHAR" :
            type == typeof(bool) ? "BOOLEAN" : type == typeof(int) ? "INTEGER" :
            type == typeof(long) ? "BIGINT" : type == typeof(double) || type == typeof(float) ? "DOUBLE" :
            type == typeof(decimal) ? "DECIMAL(38, 10)" : type == typeof(DateOnly) ? "DATE" :
            type == typeof(DateTimeOffset) ? "TIMESTAMPTZ" : type == typeof(TimeSpan) ? "INTERVAL" : null;

    private static object? Property(object? value, string name) => value?.GetType().GetProperty(name)?.GetValue(value);
    private static bool IsGeneric(Type type, Type definition) => type.IsGenericType && type.GetGenericTypeDefinition() == definition;
    private static bool IsKey(Type type) => IsGeneric(type, typeof(ReferenceKey<>)) || IsGeneric(type, typeof(SnapshotKey<>));
    internal static string Quote(string name) => '"' + name.Replace("\"", "\"\"") + '"';
}
