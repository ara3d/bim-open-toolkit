using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.DataModel;

internal static class SourceDecoder
{
    internal static string? Text(IBimData data, int index, string table, int row, List<IssueRow> issues)
    {
        if (index == -1) return null;
        if (index >= 0 && index < data.Strings.Length) return data.Strings[index];
        AddIssue(issues, "InvalidStringReference", table, row, null, $"String index {index} is outside the string table.");
        return null;
    }

    internal static int? Reference(int index, int count, string table, int row, List<IssueRow> issues, bool optional = true)
    {
        if (optional && index == -1) return null;
        if (index >= 0 && index < count) return index;
        AddIssue(issues, "InvalidReference", table, row, null, $"Index {index} is outside a referenced table of {count} rows.");
        return null;
    }

    internal static void AddIssue(List<IssueRow> issues, string code, string table, int row, int? entity, string message,
        IssueSeverity severity = IssueSeverity.Error)
        => issues.Add(new(issues.Count, severity, code, table, row, entity, message));

    internal static ImmutableArray<DescriptorRow> Descriptors(IBimData data, List<IssueRow> issues)
    {
        var rows = ImmutableArray.CreateBuilder<DescriptorRow>(data.Descriptors.Length);
        for (var i = 0; i < data.Descriptors.Length; i++)
        {
            var d = data.Descriptors[i];
            var name = Text(data, (int)d.Name, "Descriptors", i, issues);
            var group = Text(data, (int)d.Group, "Descriptors", i, issues);
            var units = Text(data, (int)d.Units, "Descriptors", i, issues);
            if (!Enum.IsDefined(d.Type)) AddIssue(issues, "UnknownParameterType", "Descriptors", i, null, $"Unknown kind {(int)d.Type}.");
            rows.Add(new(i, name, group, units, d.Type,
                new(TextNormalization.Key(name), TextNormalization.Key(group), TextNormalization.UnitKey(units), d.Type)));
        }
        return rows.MoveToImmutable();
    }

    internal static PropertyRow Property(IBimData data, int id, DescriptorRow d, ConversionOptions options, List<IssueRow> issues)
    {
        var p = data.Parameters[id];
        var row = new PropertyRow(id, (int)p.Entity, d.Id, d.Name, d.Group, d.Units, d.Key, true, p.Value);
        if (p.Value == -1 && d.Kind != ParameterType.Int && Enum.IsDefined(d.Kind))
            return row with { IsMissing = true };
        switch (d.Kind)
        {
            case ParameterType.Int: return row with { IntegerValue = p.Value };
            case ParameterType.String when p.Value >= 0 && p.Value < data.Strings.Length && data.Strings[p.Value] is not null:
                return row with { TextValue = data.Strings[p.Value] };
            case ParameterType.Entity when p.Value >= 0 && p.Value < data.Entities.Length:
                return row with { ReferenceEntityId = p.Value };
            case ParameterType.Point when p.Value >= 0 && p.Value < data.Points.Length:
                var point = data.Points[p.Value];
                if (float.IsFinite(point.X) && float.IsFinite(point.Y) && float.IsFinite(point.Z))
                    return row with { PointValue = new(point.X, point.Y, point.Z) };
                break;
            case ParameterType.Number when p.Value >= 0 && p.Value < data.Numbers.Length:
                var number = data.Numbers[p.Value];
                if (!float.IsFinite(number)) break;
                var canonical = options.NumericValuesUseDeclaredUnits
                    ? TextNormalization.CanonicalNumber(number, d.Key.Units) : (null, (string?)null);
                return row with { NumberValue = number, CanonicalNumber = canonical.Item1, CanonicalUnits = canonical.Item2 };
        }
        AddIssue(issues, "InvalidPropertyValue", "Parameters", id, row.EntityId,
            $"Cannot decode {d.Kind} value {p.Value}; raw value retained.");
        return row with { IsValid = false };
    }
}
