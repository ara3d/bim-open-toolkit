namespace Ara3D.BimOpenSchema.Federation;

/// <summary>A five-document union that shows every rule outcome the match graph (C5, C6) and
/// the studio views (C8, C11) assert against. Built in code, not from `.ifc`/`.bos` files,
/// because `.gitignore` ignores those extensions.
///
/// The parameter names below are string literals rather than references to C2's
/// (`Ara3D.Ifc.Bos`) constants: this chunk was built while C2 was still in flight, so it
/// matches C2's contract (`Ifc:LengthUnit`, `Ifc:LengthUnitToMetre`, `Ifc:AxisTag`) by name
/// instead of by reference.</summary>
public static class FederationExample
{
    public static IReadOnlyList<UnionInput> Documents() =>
    [
        BuildArch(),
        BuildStruct(),
        BuildElec(),
        BuildSite(),
        BuildPlumb(),
    ];

    public static BimData Union() => BosUnion.Union(Documents());

    private static UnionInput BuildArch()
    {
        var doc = new DocumentFixture("Arch");
        var l1 = doc.AddStorey("L1", 0.0, "arch-l1");
        var l2 = doc.AddStorey("L2", 8.0833, "gA2");
        doc.AddStorey("Parking", -16.9167, "arch-parking");
        doc.AddStorey("Parapet", 47.67, "arch-parapet");

        var room101 = doc.AddSpace("Café", "Rooms", "arch-room-101");
        doc.AddRoomNumber(room101, "101");
        doc.Relate(room101, l1, RelationType.MemberOf);

        var room201 = doc.AddSpace("Corridor", "Rooms", "arch-room-201");
        doc.AddRoomNumber(room201, "201");
        doc.Relate(room201, l2, RelationType.MemberOf);

        var areaA1 = doc.AddSpace("A1", "Areas", "arch-area-a1");
        doc.Relate(areaA1, l1, RelationType.MemberOf);

        foreach (var tag in new[] { "1", "2", "A", "F1" })
            doc.AddAxis(tag);

        var door = doc.AddElement("IFCDOOR", "Arch Door 1");
        doc.Relate(door, l1, RelationType.ContainedIn);

        return doc.Build("FOOT", 0.3048);
    }

    private static UnionInput BuildStruct()
    {
        var doc = new DocumentFixture("Struct");
        doc.AddStorey("Parking", -16.9167, "struct-parking");
        doc.AddStorey("L1_Low", 0.0, "struct-l1-low");
        var l2 = doc.AddStorey("L2", 8.0833, "struct-l2");

        foreach (var tag in new[] { "1", "2" })
            doc.AddAxis(tag);

        var beam = doc.AddElement("IFCBEAM", "Struct Beam 1");
        doc.Relate(beam, l2, RelationType.ContainedIn);

        return doc.Build("FOOT", 0.3048);
    }

    private static UnionInput BuildElec()
    {
        var doc = new DocumentFixture("Elec");
        var l1 = doc.AddStorey("L1", -0.0417, "elec-l1");
        doc.AddStorey("L2", 8.0833, "gShared");

        var e1 = doc.AddSpace("E1", "Spaces", "elec-e1");
        doc.AddIdentityData(e1, "101", "Café");
        doc.Relate(e1, l1, RelationType.MemberOf);

        var e2 = doc.AddSpace("E2", "Spaces", "elec-e2");
        doc.AddIdentityData(e2, "Unoccupied");
        doc.Relate(e2, l1, RelationType.MemberOf);

        var e3 = doc.AddSpace("E3", "Spaces", "elec-e3");
        doc.AddIdentityData(e3, "999");
        doc.Relate(e3, l1, RelationType.MemberOf);

        foreach (var tag in new[] { "1", "2", "A" })
            doc.AddAxis(tag);

        var lightFixture = doc.AddElement("IFCLIGHTFIXTURE", "Elec Light Fixture 1");
        doc.Relate(lightFixture, l1, RelationType.ContainedIn);

        return doc.Build("FOOT", 0.3048);
    }

    private static UnionInput BuildSite()
    {
        var doc = new DocumentFixture("Site");
        doc.AddStorey("Datum", -241.4016, "gShared");
        doc.AddStorey("Parapet", 14.4536, "site-parapet");
        return doc.Build("METRE", 1.0);
    }

    private static UnionInput BuildPlumb()
    {
        var doc = new DocumentFixture("Plumb");
        var pl1 = doc.AddStorey("P-L1", 0.0, "plumb-p-l1");
        var p1 = doc.AddSpace("P1", "Spaces", "plumb-p1");
        doc.AddIdentityData(p1, "Unoccupied");
        doc.Relate(p1, pl1, RelationType.MemberOf);
        return doc.Build(unit: null, unitToMetre: null);
    }

    /// <summary>Builds one document's worth of entities by hand, in the shape
    /// IfcToBosConverter would produce: a category entity per distinct IFC type, an instance
    /// entity per storey/space/axis/element, and parameters grouped the way C2's converter
    /// groups them (by IFC entity name, or "Other"/"Identity Data" for Revit-shaped facts).</summary>
    private sealed class DocumentFixture
    {
        private readonly string _title;
        private readonly BimDataBuilder _builder = new();
        private readonly DocumentIndex _document;
        private readonly Dictionary<string, EntityIndex> _categories = [];
        private long _nextLocalId = 1;

        public DocumentFixture(string title)
        {
            _title = title;
            _document = _builder.AddDocument(title, $"example/{title}.ifc");
        }

        public EntityIndex AddStorey(string name, double elevationFeetOrMetres, string globalId)
        {
            var e = AddInstance("IFCBUILDINGSTOREY", name, globalId);
            _builder.AddParameter(e, elevationFeetOrMetres, "Ifc:Elevation", "", "IFCBUILDINGSTOREY");
            return e;
        }

        public EntityIndex AddSpace(string name, string revitCategory, string globalId)
        {
            var e = AddInstance("IFCSPACE", name, globalId);
            _builder.AddParameter(e, revitCategory, "Category", "", "Other");
            return e;
        }

        public void AddRoomNumber(EntityIndex space, string roomNumber)
            => _builder.AddParameter(space, roomNumber, "Ifc:Room:Number", "", "IFCSPACE");

        public void AddIdentityData(EntityIndex space, string roomNumber, string? roomName = null)
        {
            _builder.AddParameter(space, roomNumber, "Room Number", "", "Identity Data");
            if (roomName != null)
                _builder.AddParameter(space, roomName, "Room Name", "", "Identity Data");
        }

        public EntityIndex AddAxis(string tag)
        {
            var e = AddInstance("IFCGRIDAXIS", tag, "");
            _builder.AddParameter(e, tag, "Ifc:AxisTag", "", "IFCGRIDAXIS");
            return e;
        }

        public EntityIndex AddElement(string category, string name)
            => AddInstance(category, name, "");

        public void Relate(EntityIndex a, EntityIndex b, RelationType type)
            => _builder.AddRelation(a, b, type);

        public UnionInput Build(string? unit, double? unitToMetre)
        {
            var project = AddInstance("IFCPROJECT", $"{_title} Project", "");
            if (unit != null)
            {
                _builder.AddParameter(project, unit, "Ifc:LengthUnit", "", "IFCPROJECT");
                _builder.AddParameter(project, unitToMetre!.Value, "Ifc:LengthUnitToMetre", "", "IFCPROJECT");
            }
            return new UnionInput(_builder.Build(), _title, $"example/{_title}.ifc");
        }

        private EntityIndex AddInstance(string category, string name, string globalId)
            => _builder.AddEntity(_nextLocalId++, globalId, _document, name, CategoryEntity(category), BimDataBuilder.InvalidEntityIndex);

        private EntityIndex CategoryEntity(string name)
        {
            if (_categories.TryGetValue(name, out var e))
                return e;
            e = _builder.AddEntity(-1, "", _document, name, BimDataBuilder.InvalidEntityIndex, BimDataBuilder.InvalidEntityIndex);
            _categories.Add(name, e);
            return e;
        }
    }
}
