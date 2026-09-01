namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>The shared column vocabulary of the pack. Nodes that produce these
/// columns and nodes that consume them agree by these names; changing one is a
/// contract change.</summary>
public static class BimColumns
{
    public const string EntityIndex = "EntityIndex";
    public const string LocalId = "LocalId";
    public const string GlobalId = "GlobalId";
    public const string Name = "Name";
    public const string Category = "Category";
    public const string CategoryType = "CategoryType";
    public const string Type = "Type";
    public const string ClassName = "ClassName";
    public const string Level = "Level";
    public const string Elevation = "Elevation";
    public const string Room = "Room";
    public const string Document = "Document";
    public const string Workset = "Workset";
    public const string Group = "Group";

    public const string MinX = "MinX";
    public const string MinY = "MinY";
    public const string MinZ = "MinZ";
    public const string MaxX = "MaxX";
    public const string MaxY = "MaxY";
    public const string MaxZ = "MaxZ";
    public const string SizeX = "SizeX";
    public const string SizeY = "SizeY";
    public const string SizeZ = "SizeZ";
    public const string CenterX = "CenterX";
    public const string CenterY = "CenterY";
    public const string CenterZ = "CenterZ";
    public const string FootprintArea = "FootprintArea";
    public const string Volume = "Volume";
    public const string Diagonal = "Diagonal";

    public const string Number = "Number";
    public const string UnboundedHeight = "UnboundedHeight";
    public const string ElementCount = "ElementCount";
    public const string RoomCount = "RoomCount";

    public const string Discipline = "Discipline";
    public const string RoomClass = "RoomClass";

    public const string Door = "Door";
    public const string DoorName = "DoorName";
    public const string FromRoom = "FromRoom";
    public const string ToRoom = "ToRoom";
    public const string Hops = "Hops";
    public const string Distance = "Distance";

    public const string ParameterGroup = "ParameterGroup";
    public const string ValueType = "ValueType";
    public const string Count = "Count";
    public const string Distinct = "Distinct";
    public const string FillRate = "FillRate";

    /// <summary>The name a door edge uses when a door has no room on one side.</summary>
    public const string Outside = "Outside";
}
