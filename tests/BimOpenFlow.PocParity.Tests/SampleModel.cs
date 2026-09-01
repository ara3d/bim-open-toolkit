using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.IO;
using Ara3D.DataTable;
using Ara3D.Utils;

namespace BimOpenFlow.PocParity.Tests;

/// <summary>
/// The fixture data every parity test evaluates against: one small .bos model
/// (three walls and a door, with Height and Level parameters) written once per
/// test run, plus a few in-code tables playing the PoC's external-data roles.
/// </summary>
[SetUpFixture]
public sealed class SampleModel
{
    public static string BosPath { get; private set; } = null!;

    private static string _folder = null!;

    /// <summary>Walls-001/2/3 at heights 2.5/3.0/2.1 (levels L1/L1/L2), Door-001 at 2.0 (L1).</summary>
    private static BimData BuildData()
    {
        const EntityIndex none = BimDataBuilder.InvalidEntityIndex;
        var bdb = new BimDataBuilder();
        var doc = bdb.AddDocument("ParityDoc", "parity.ifc");
        var walls = bdb.AddEntity(1, "guid-cat-walls", doc, "Walls", none, none);
        var doors = bdb.AddEntity(2, "guid-cat-doors", doc, "Doors", none, none);
        var wallType = bdb.AddEntity(3, "guid-type-wall", doc, "BasicWall", none, none);
        var doorType = bdb.AddEntity(4, "guid-type-door", doc, "BasicDoor", none, none);

        void Element(int id, string guid, string name, EntityIndex category, EntityIndex type, double height, string level)
        {
            var e = bdb.AddEntity(id, guid, doc, name, category, type);
            bdb.AddParameter(e, height, "Height", "m", "Dimensions");
            bdb.AddParameter(e, level, "Level", "", "Location");
        }

        Element(5, "guid-wall-1", "Wall-001", walls, wallType, 2.5, "L1");
        Element(6, "guid-wall-2", "Wall-002", walls, wallType, 3.0, "L1");
        Element(7, "guid-wall-3", "Wall-003", walls, wallType, 2.1, "L2");
        Element(8, "guid-door-1", "Door-001", doors, doorType, 2.0, "L1");
        return bdb.Build();
    }

    [OneTimeSetUp]
    public void WriteBosFile()
    {
        _folder = Path.Combine(Path.GetTempPath(), "bimopenflow-poc-parity", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_folder);
        BosPath = Path.Combine(_folder, "parity.bos");
        BuildData().WriteToParquetZip(new FilePath(BosPath));
    }

    [OneTimeTearDown]
    public void DeleteFolder()
    {
        try
        {
            Directory.Delete(_folder, recursive: true);
        }
        catch (IOException)
        {
        }
    }

    /// <summary>A scratch file path inside the fixture folder (cleaned with it).</summary>
    public static string ScratchPath(string name)
        => Path.Combine(_folder, name);

    /// <summary>The in-code fixture tables served by the test.table source node.</summary>
    public static IDataTable Table(string name)
        => name switch
        {
            // The PoC attach.column scenario: external values keyed by GlobalId,
            // including an element with no height (null) and one unknown to the model.
            "heights" => Build("heights",
                ("GlobalId", typeof(string), ["guid-wall-1", "guid-wall-2", "guid-wall-3", "guid-door-1", "guid-wall-9"]),
                ("Height", typeof(double), [2.5, 3.0, 2.1, 2.0, null])),
            "instances" => Build("instances",
                ("GlobalId", typeof(string), ["guid-wall-1", "guid-wall-2", "guid-wall-3", "guid-door-1"]),
                ("Category", typeof(string), ["Walls", "Walls", "Walls", "Doors"])),
            "wallIds" => Build("wallIds",
                ("GlobalId", typeof(string), ["guid-wall-1", "guid-wall-3"])),
            _ => throw new ArgumentException($"No fixture table named '{name}'"),
        };

    private static IDataTable Build(string name, params (string Name, Type Type, object?[] Cells)[] columns)
    {
        var builder = new DataTableBuilder(name);
        foreach (var (columnName, type, cells) in columns)
            builder.AddColumn(cells, columnName, type);
        return builder.Build();
    }
}
