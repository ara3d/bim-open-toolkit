using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.DataModel;

public enum ColumnKind { Integer, Int64, Number, Text, Boolean }
public sealed record Column(string Name, ColumnKind Kind, bool Nullable = false, bool PrimaryKey = false);
/// <summary>Rows are projected on demand; a sink can stream them without duplicating the entire model.</summary>
public sealed record RelationalTable(string Name, ImmutableArray<Column> Columns, int RowCount,
    Func<int, ImmutableArray<object?>> ReadRow);

public static class RelationalTables
{
    public static ImmutableArray<RelationalTable> ToRelationalTables(this BimModel model)
    {
        var t = model.Tables;
        return [
            new("ModelInfo", [S("SchemaVersion"), S("SourceId"), S("SourceSchemaVersion"), S("Generator", true), S("GeometryUnits"), S("NumericValuePolicy")], 1,
                _ => [t.Metadata.SchemaVersion, t.Metadata.SourceId, t.Metadata.SourceSchemaVersion, t.Metadata.Generator, t.Metadata.GeometryUnits, t.Metadata.NumericValuePolicy]),
            new("Documents", [I("Id", key: true), S("Title", true), S("Path", true)], t.Documents.Length,
                i => { var r = t.Documents[i]; return [r.Id, r.Title, r.Path]; }),
            new("Entities", [I("Id", key: true), S("Key"), L("LocalId"), S("GlobalId", true), I("DocumentId", true),
                S("DocumentTitle", true), S("Name", true), I("CategoryId", true), S("Category", true), I("TypeId", true),
                S("Type", true), B("IsType"), B("IsCategory")], t.Entities.Length,
                i => { var r = t.Entities[i]; return [r.Id, r.Key, r.LocalId, r.GlobalId, r.DocumentId, r.DocumentTitle,
                    r.Name, r.CategoryId, r.Category, r.TypeId, r.Type, r.IsType, r.IsCategory]; }),
            new("Descriptors", [I("Id", key: true), S("Name", true), S("GroupName", true), S("Units", true), S("Kind"),
                S("NormalizedName"), S("NormalizedGroup"), S("NormalizedUnits")], t.Descriptors.Length,
                i => { var r = t.Descriptors[i]; return [r.Id, r.Name, r.Group, r.Units, r.Kind.ToString(), r.Key.Name, r.Key.Group, r.Key.Units]; }),
            new("Properties", [I("Id", key: true), I("EntityId"), I("DescriptorId"), S("Name", true), S("GroupName", true),
                S("Units", true), S("Kind"), S("NormalizedName"), S("NormalizedGroup"), S("NormalizedUnits"), B("IsValid"),
                I("RawValue"), L("IntegerValue", true), N("NumberValue", true), S("TextValue", true), I("ReferenceEntityId", true),
                N("PointX", true), N("PointY", true), N("PointZ", true), N("CanonicalNumber", true), S("CanonicalUnits", true), B("IsMissing")], t.Properties.Length,
                i => { var r = t.Properties[i]; return [r.Id, r.EntityId, r.DescriptorId, r.Name, r.Group, r.Units,
                    r.Key.Kind.ToString(), r.Key.Name, r.Key.Group, r.Key.Units, r.IsValid, r.RawValue, r.IntegerValue,
                    r.NumberValue, r.TextValue, r.ReferenceEntityId, r.PointValue?.X, r.PointValue?.Y, r.PointValue?.Z,
                    r.CanonicalNumber, r.CanonicalUnits, r.IsMissing]; }),
            new("Edges", [I("Id", key: true), I("SourceId"), I("TargetId"), S("Kind"), S("Origin"), I("SourceRowId")], t.Edges.Length,
                i => { var r = t.Edges[i]; return [r.Id, r.SourceId, r.TargetId, r.Kind, r.Origin.ToString(), r.SourceRowId]; }),
            new("Instances", [I("Id", key: true), I("EntityId"), I("MeshId"), I("MaterialId", true), B("IsHidden"), L("TriangleCount"),
                N("MinX"), N("MinY"), N("MinZ"), N("MaxX"), N("MaxY"), N("MaxZ")], t.Instances.Length,
                i => { var r = t.Instances[i]; return [r.Id, r.EntityId, r.MeshId, r.MaterialId, r.IsHidden, r.TriangleCount,
                    r.Bounds.Min.X, r.Bounds.Min.Y, r.Bounds.Min.Z, r.Bounds.Max.X, r.Bounds.Max.Y, r.Bounds.Max.Z]; }),
            new("Geometry", [I("EntityId", key: true), I("InstanceCount"), L("TriangleCount"), I("HiddenInstanceCount"),
                N("MinX"), N("MinY"), N("MinZ"), N("MaxX"), N("MaxY"), N("MaxZ"), N("CenterX"), N("CenterY"), N("CenterZ"),
                N("SizeX"), N("SizeY"), N("SizeZ"), N("BoundsVolume")], t.Geometry.Length,
                i => { var r = t.Geometry[i]; var b = r.Bounds; return [r.EntityId, r.InstanceCount, r.TriangleCount, r.HiddenInstanceCount,
                    b.Min.X, b.Min.Y, b.Min.Z, b.Max.X, b.Max.Y, b.Max.Z, b.Center.X, b.Center.Y, b.Center.Z, b.Size.X, b.Size.Y, b.Size.Z, b.Volume]; }),
            new("Issues", [I("Id", key: true), S("Severity"), S("Code"), S("SourceTable"), I("SourceRowId"), I("EntityId", true), S("Message")], t.Issues.Length,
                i => { var r = t.Issues[i]; return [r.Id, r.Severity.ToString(), r.Code, r.Table, r.SourceRowId, r.EntityId, r.Message]; })
        ];
    }

    private static Column I(string name, bool nullable = false, bool key = false) => new(name, ColumnKind.Integer, nullable, key);
    private static Column L(string name, bool nullable = false) => new(name, ColumnKind.Int64, nullable);
    private static Column N(string name, bool nullable = false) => new(name, ColumnKind.Number, nullable);
    private static Column S(string name, bool nullable = false) => new(name, ColumnKind.Text, nullable);
    private static Column B(string name) => new(name, ColumnKind.Boolean);
}
