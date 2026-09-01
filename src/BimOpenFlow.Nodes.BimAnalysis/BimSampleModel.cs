using Ara3D.BimOpenSchema;
using static Ara3D.BimOpenSchema.CommonRevitParameters;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>A small deterministic two-storey building, used as the demo model for
/// sample analyses and as the fixture every pack test asserts against. Changing any
/// value here is a contract change for the whole test suite.
///
/// Level 1 (elev 0): Office 101, Corridor 102, Kitchen 103, WC 104; walls W1..W2;
/// doors D1 (101-102), D2 (102-103), D3 (102-104), D4 (102-exterior); window WN1
/// (in Office 101); structural column SC1.
/// Level 2 (elev 3): Meeting 201, Corridor 202; wall W3; door D5 (201-202);
/// duct DU1; lighting fixture LF1 (in Meeting 201).</summary>
public static class BimSampleModel
{
    public static BimData Build()
    {
        var b = new BimDataBuilder();
        var doc = b.AddDocument("Sample Tower", "sample://tower");
        var nextId = 1000L;

        EntityIndex Entity(string name, EntityIndex category, EntityIndex type)
            => b.AddEntity(++nextId, $"GUID-{nextId}", doc, name, category, type);

        EntityIndex Category(string name, string categoryType)
        {
            var e = b.AddEntity(++nextId, $"GUID-{nextId}", doc, name,
                BimDataBuilder.InvalidEntityIndex, BimDataBuilder.InvalidEntityIndex);
            b.AddParameter(e, categoryType, CategoryCategoryType, "", "Category");
            return e;
        }

        var catLevels = Category("Levels", "Model");
        var catRooms = Category("Rooms", "Model");
        var catWalls = Category("Walls", "Model");
        var catDoors = Category("Doors", "Model");
        var catWindows = Category("Windows", "Model");
        var catDucts = Category("Ducts", "Model");
        var catColumns = Category("Structural Columns", "Model");
        var catLights = Category("Lighting Fixtures", "Model");

        var wallType = Entity("Basic Wall 200mm", catWalls, BimDataBuilder.InvalidEntityIndex);
        var doorType = Entity("Single-Flush 0915", catDoors, BimDataBuilder.InvalidEntityIndex);

        EntityIndex Level(string name, double elevation)
        {
            var e = Entity(name, catLevels, BimDataBuilder.InvalidEntityIndex);
            b.AddParameter(e, elevation, LevelElevation, "m", "Constraints");
            return e;
        }

        var level1 = Level("Level 1", 0);
        var level2 = Level("Level 2", 3);

        void Bounds(EntityIndex e, double x0, double y0, double z0, double x1, double y1, double z1)
        {
            b.AddParameter(e, new Point((float)x0, (float)y0, (float)z0), ElementBoundsMin, "m", "Geometry");
            b.AddParameter(e, new Point((float)x1, (float)y1, (float)z1), ElementBoundsMax, "m", "Geometry");
        }

        EntityIndex Room(string name, string number, EntityIndex level,
            double x0, double y0, double z0, double x1, double y1, double z1)
        {
            var e = Entity(name, catRooms, BimDataBuilder.InvalidEntityIndex);
            b.AddParameter(e, number, RoomNumber, "", "Identity Data");
            b.AddParameter(e, level, ElementLevel, "", "Constraints");
            b.AddParameter(e, (x1 - x0) * (y1 - y0) * (z1 - z0), RoomVolume, "m3", "Dimensions");
            b.AddParameter(e, z1 - z0, RoomUnboundedHeight, "m", "Dimensions");
            Bounds(e, x0, y0, z0, x1, y1, z1);
            return e;
        }

        var office101 = Room("Office", "101", level1, 0, 0, 0, 5, 4, 3);
        var corridor102 = Room("Corridor", "102", level1, 5, 0, 0, 7, 8, 3);
        var kitchen103 = Room("Kitchen", "103", level1, 0, 4, 0, 5, 8, 3);
        var wc104 = Room("WC", "104", level1, 7, 0, 0, 9, 3, 3);
        var meeting201 = Room("Meeting Room", "201", level2, 0, 0, 3, 5, 8, 6);
        var corridor202 = Room("Corridor", "202", level2, 5, 0, 3, 7, 8, 6);

        EntityIndex Element(string name, EntityIndex category, EntityIndex type, EntityIndex level,
            string className, double x0, double y0, double z0, double x1, double y1, double z1)
        {
            var e = Entity(name, category, type);
            b.AddParameter(e, level, ElementLevel, "", "Constraints");
            b.AddParameter(e, className, ObjectTypeName, "", "Identity Data");
            b.AddParameter(e, 1, ElementWorksetId, "", "Identity Data");
            Bounds(e, x0, y0, z0, x1, y1, z1);
            return e;
        }

        Element("W1", catWalls, wallType, level1, "Wall", 0, -0.1, 0, 9, 0.1, 3);
        var w2 = Element("W2", catWalls, wallType, level1, "Wall", -0.1, 0, 0, 0.1, 8, 3);
        Element("W3", catWalls, wallType, level2, "Wall", 0, -0.1, 3, 9, 0.1, 6);

        EntityIndex Door(string name, EntityIndex level, EntityIndex from, EntityIndex to,
            double cx, double cy, double z)
        {
            var e = Element(name, catDoors, doorType, level, "Door",
                cx - 0.5, cy - 0.1, z, cx + 0.5, cy + 0.1, z + 2.1);
            if (from >= 0)
                b.AddParameter(e, from, FIFromRoom, "", "Constraints");
            if (to >= 0)
                b.AddParameter(e, to, FIToRoom, "", "Constraints");
            b.AddParameter(e, new Point((float)cx, (float)cy, (float)z), ElementLocationPoint, "m", "Geometry");
            return e;
        }

        Door("D1", level1, office101, corridor102, 5, 2, 0);
        Door("D2", level1, corridor102, kitchen103, 5, 6, 0);
        Door("D3", level1, corridor102, wc104, 7, 1.5, 0);
        Door("D4", level1, corridor102, BimDataBuilder.InvalidEntityIndex, 6, 8, 0);
        Door("D5", level2, meeting201, corridor202, 5, 4, 3);

        var wn1 = Element("WN1", catWindows, BimDataBuilder.InvalidEntityIndex, level1, "Window",
            2, -0.1, 0.9, 3.2, 0.1, 2.4);
        b.AddParameter(wn1, w2, FIHost, "", "Constraints");
        b.AddParameter(wn1, office101, FIRoom, "", "Constraints");

        Element("SC1", catColumns, BimDataBuilder.InvalidEntityIndex, level1, "Column",
            4.4, 3.4, 0, 4.6, 3.6, 3);
        Element("DU1", catDucts, BimDataBuilder.InvalidEntityIndex, level2, "Duct",
            0, 3.9, 5.5, 9, 4.1, 5.7);
        var lf1 = Element("LF1", catLights, BimDataBuilder.InvalidEntityIndex, level2, "LightingFixture",
            2.4, 3.9, 5.8, 2.6, 4.1, 6);
        b.AddParameter(lf1, meeting201, FISpace, "", "Constraints");

        b.Geometry = new BimGeometry();
        return b.Build();
    }
}
