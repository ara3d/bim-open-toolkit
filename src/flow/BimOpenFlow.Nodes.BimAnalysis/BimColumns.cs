using Ara3D.BimOpenSchema;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>The pack's column names, read from the registry in bim-open-data (<see cref="ColumnKinds"/>),
/// where each column's type, unit and meaning live. A name is not declared here.</summary>
public static class BimColumns
{
    public static string EntityIndex => ColumnKinds.EntityIndex.Name;
    public static string LocalId => ColumnKinds.LocalId.Name;
    public static string GlobalId => ColumnKinds.GlobalId.Name;
    public static string Name => ColumnKinds.Name.Name;
    public static string Category => ColumnKinds.Category.Name;
    public static string CategoryType => ColumnKinds.CategoryType.Name;
    public static string Type => ColumnKinds.Type.Name;
    public static string ClassName => ColumnKinds.ClassName.Name;
    public static string Level => ColumnKinds.Level.Name;
    public static string Elevation => ColumnKinds.Elevation.Name;
    public static string Room => ColumnKinds.Room.Name;
    public static string Document => ColumnKinds.Document.Name;
    public static string Workset => ColumnKinds.Workset.Name;
    public static string Group => ColumnKinds.Group.Name;

    public static string MinX => ColumnKinds.MinX.Name;
    public static string MinY => ColumnKinds.MinY.Name;
    public static string MinZ => ColumnKinds.MinZ.Name;
    public static string MaxX => ColumnKinds.MaxX.Name;
    public static string MaxY => ColumnKinds.MaxY.Name;
    public static string MaxZ => ColumnKinds.MaxZ.Name;
    public static string SizeX => ColumnKinds.SizeX.Name;
    public static string SizeY => ColumnKinds.SizeY.Name;
    public static string SizeZ => ColumnKinds.SizeZ.Name;
    public static string CenterX => ColumnKinds.CenterX.Name;
    public static string CenterY => ColumnKinds.CenterY.Name;
    public static string CenterZ => ColumnKinds.CenterZ.Name;
    public static string FootprintArea => ColumnKinds.FootprintArea.Name;
    public static string Volume => ColumnKinds.Volume.Name;
    public static string Diagonal => ColumnKinds.Diagonal.Name;

    public static string Number => ColumnKinds.Number.Name;
    public static string UnboundedHeight => ColumnKinds.UnboundedHeight.Name;
    public static string ElementCount => ColumnKinds.ElementCount.Name;
    public static string RoomCount => ColumnKinds.RoomCount.Name;

    public static string Discipline => ColumnKinds.Discipline.Name;
    public static string RoomClass => ColumnKinds.RoomClass.Name;

    public static string Door => ColumnKinds.Door.Name;
    public static string DoorName => ColumnKinds.DoorName.Name;
    public static string FromRoom => ColumnKinds.FromRoom.Name;
    public static string ToRoom => ColumnKinds.ToRoom.Name;
    public static string Hops => ColumnKinds.Hops.Name;
    public static string Distance => ColumnKinds.Distance.Name;

    public static string ParameterGroup => ColumnKinds.ParameterGroup.Name;
    public static string ValueType => ColumnKinds.ValueType.Name;
    public static string Count => ColumnKinds.Count.Name;
    public static string Distinct => ColumnKinds.Distinct.Name;
    public static string FillRate => ColumnKinds.FillRate.Name;

    /// <summary>The name a door edge uses when a door has no room on one side.</summary>
    public const string Outside = "Outside";
}
