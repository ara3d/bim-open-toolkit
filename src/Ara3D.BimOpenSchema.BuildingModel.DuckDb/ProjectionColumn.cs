using System.Collections;
using System.Collections.Concurrent;
using System.Globalization;
using System.Collections.Immutable;
using System.Linq.Expressions;
using System.Reflection;
using DuckDB.NET.Data;
using Platonic;

namespace Ara3D.BimOpenSchema.BuildingModel.DuckDb;

/// <summary>Maps domain values to typed SQL columns without discarding fact provenance.</summary>
[Impure]
internal sealed record ProjectionColumn(string Name, Type Type, Func<object?, object?> Read)
{
    // Column trees, SQL type text and property accessors depend only on the type, but every cell of every
    // row needs them, so each is built once by reflection and reused instead of rediscovered per cell.
    private static readonly ConcurrentDictionary<Type, ProjectionColumn[]> columns = new();
    private static readonly ConcurrentDictionary<Type, string> sqlTypes = new();
    private static readonly ConcurrentDictionary<(Type Owner, string Name), Func<object?, object?>> accessors = new();

    internal static ProjectionColumn[] ForRecord(Type type) => columns.GetOrAdd(type, Build);

    private static ProjectionColumn[] Build(Type type)
        => type.GetProperties(BindingFlags.Instance | BindingFlags.Public)
            .SelectMany(property => Expand(CoreSchema.ColumnName(property.Name), property.PropertyType, Getter(property)))
            .ToArray();

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
                var value = Getter(property);
                foreach (var column in Expand(name + "_" + CoreSchema.ColumnName(variant.Name), property.PropertyType,
                             row => read(row) is { } source && variant.IsInstanceOfType(source) ? value(source) : null))
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
            {
                var value = Getter(property);
                foreach (var column in Expand(unwrap ? name : name + "_" + CoreSchema.ColumnName(property.Name), property.PropertyType,
                             row => value(read(row))))
                    yield return column;
            }
            if (properties.Length == 0) throw new NotSupportedException($"Unsupported projection type: {type}");
        }
    }

    internal string SqlType => TypeSql(Type);

    private static string TypeSql(Type type) => sqlTypes.GetOrAdd(type, BuildTypeSql);

    private static string BuildTypeSql(Type type)
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

    /// <summary>Writes one cell straight into a DuckDB appender row, or null when the type still needs SQL text.</summary>
    internal static Action<IDuckDBAppenderRow, object?>? Appender(Type type)
    {
        if (IsText(type)) return (row, value) => Append(row, value?.ToString());
        if (type == typeof(bool)) return (row, value) => row.AppendValue((bool?)value);
        if (type == typeof(int)) return (row, value) => row.AppendValue((int?)value);
        if (type == typeof(long)) return (row, value) => row.AppendValue((long?)value);
        if (type == typeof(double)) return (row, value) => row.AppendValue((double?)value);
        if (type == typeof(float)) return (row, value) => row.AppendValue((double?)(float?)value);
        if (type == typeof(decimal)) return (row, value) => row.AppendValue((decimal?)value);
        if (type == typeof(DateOnly)) return (row, value) => row.AppendValue((DateOnly?)value);
        if (type == typeof(DateTimeOffset)) return (row, value) => row.AppendValue((DateTimeOffset?)value);
        if (type == typeof(TimeSpan)) return (row, value) => row.AppendValue((TimeSpan?)value);
        if (IsGeneric(type, typeof(ImmutableArray<>)) && IsText(type.GetGenericArguments()[0]))
            return (row, value) => Append(row, value is null ? null : Texts(value));
        return null;
    }

    private static void Append(IDuckDBAppenderRow row, string? value)
    {
        if (value is null) row.AppendNullValue(); else row.AppendValue(value);
    }

    private static void Append(IDuckDBAppenderRow row, IEnumerable<string>? values)
    {
        if (values is null) row.AppendNullValue(); else row.AppendValue(values);
    }

    // The appender's list writer inspects the concrete collection, so a lazy sequence is not accepted here.
    private static string[] Texts(object value) => ((IEnumerable)value).Cast<object>().Select(item => item.ToString()!).ToArray();

    private static bool IsText(Type type) => IsKey(type) || type == typeof(string) || type.IsEnum;

    private static string? ScalarType(Type type)
        => type == typeof(string) || type.IsEnum ? "VARCHAR" :
            type == typeof(bool) ? "BOOLEAN" : type == typeof(int) ? "INTEGER" :
            type == typeof(long) ? "BIGINT" : type == typeof(double) || type == typeof(float) ? "DOUBLE" :
            type == typeof(decimal) ? "DECIMAL(38, 10)" : type == typeof(DateOnly) ? "DATE" :
            type == typeof(DateTimeOffset) ? "TIMESTAMPTZ" : type == typeof(TimeSpan) ? "INTERVAL" : null;

    // Fact and LinkSet variants only expose some of these names, so the lookup is by the value's runtime type.
    private static object? Property(object? value, string name) => value is null ? null : Accessor(value.GetType(), name)(value);

    private static Func<object?, object?> Accessor(Type owner, string name)
        => accessors.GetOrAdd((owner, name), key => key.Owner.GetProperty(key.Name) is { } property ? Getter(property) : Missing);

    private static object? Missing(object? value) => null;

    private static Func<object?, object?> Getter(PropertyInfo property)
    {
        var row = Expression.Parameter(typeof(object), "row");
        var get = Expression.Lambda<Func<object, object?>>(
            Expression.Convert(Expression.Property(Expression.Convert(row, property.DeclaringType!), property), typeof(object)), row).Compile();
        return value => value is null ? null : get(value);
    }

    private static bool IsGeneric(Type type, Type definition) => type.IsGenericType && type.GetGenericTypeDefinition() == definition;
    private static bool IsKey(Type type) => IsGeneric(type, typeof(ReferenceKey<>)) || IsGeneric(type, typeof(SnapshotKey<>));
    internal static string Quote(string name) => '"' + name.Replace("\"", "\"\"") + '"';
}
