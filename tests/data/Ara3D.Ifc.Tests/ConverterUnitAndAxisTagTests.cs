using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.IO;
using BimOpenToolkit.TestSupport;

namespace Ara3D.Ifc.Tests;

/// <summary>TKT-30 chunk C2: IfcLengthUnit.Read, and the converter's IFCPROJECT length-unit
/// parameters and IFCGRIDAXIS Ifc:AxisTag parameter.</summary>
[TestFixture]
public static class ConverterUnitAndAxisTagTests
{
    /// <summary>An IFCCONVERSIONBASEDUNIT length unit (FOOT, factor 0.3048 against METRE, as in
    /// Snowdon Structural: "#22=IFCCONVERSIONBASEDUNIT(#20,.LENGTHUNIT.,'FOOT',#21)") plus two
    /// IFCGRIDAXIS entities.</summary>
    private static readonly string FootUnitAndAxesIfc = MiniIfc.Document("""
        #1=IFCDIMENSIONALEXPONENTS(1,0,0,0,0,0,0);
        #2=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
        #3=IFCMEASUREWITHUNIT(IFCRATIOMEASURE(0.3048),#2);
        #4=IFCCONVERSIONBASEDUNIT(#1,.LENGTHUNIT.,'FOOT',#3);
        #5=IFCUNITASSIGNMENT((#4));
        #6=IFCPROJECT('project-gid',$,'Project',$,$,$,$,(),#5);
        #7=IFCGRIDAXIS('A',$,.T.);
        #8=IFCGRIDAXIS('B',$,.T.);
        """, MiniIfc.Ifc2x3, "foot-unit-and-axes-test.ifc", "ViewDefinition");

    private static string WriteTempIfc(string prefix, string content)
    {
        var path = Path.Combine(TestData.OutputFolder, $"{prefix}-{Guid.NewGuid():N}.ifc");
        File.WriteAllText(path, content, System.Text.Encoding.ASCII);
        return path;
    }

    private static BimData Convert(string path)
    {
        IfcToBosConverter? converter = null;
        try
        {
            converter = new IfcToBosConverter(path);
            return converter.BimDataBuilder.Build();
        }
        finally
        {
            converter?.IfcFile.Dispose();
        }
    }

    private static EntityModel? FindByCategory(BimObjectModel bom, string category)
        => bom.Entities.FirstOrDefault(e => e.Category == category);

    private static IEnumerable<EntityModel> FindAllByCategory(BimObjectModel bom, string category)
        => bom.Entities.Where(e => e.Category == category);

    [Test]
    public static void DuplexGivesMetreAndOne()
    {
        TestData.RequireTestKit();
        var bimData = Convert(TestData.DuplexIfc);
        var bom = new BimObjectModel(bimData, true);

        var project = FindByCategory(bom, "IFCPROJECT");
        Assert.That(project, Is.Not.Null, "Expected an IFCPROJECT entity");
        Assert.That(project!.GetParameterAsString(IfcLengthUnit.NameParameter), Is.EqualTo("METRE"));
        Assert.That(project.GetParameterAsNumber(IfcLengthUnit.ScaleParameter), Is.EqualTo(1.0).Within(1e-9));
    }

    [Test]
    public static void FootUnitAndTwoGridAxesAreRecorded()
    {
        var path = WriteTempIfc("foot-unit-and-axes", FootUnitAndAxesIfc);
        var bimData = Convert(path);
        var bom = new BimObjectModel(bimData, true);

        var project = FindByCategory(bom, "IFCPROJECT");
        Assert.That(project, Is.Not.Null, "Expected an IFCPROJECT entity");
        Assert.That(project!.GetParameterAsString(IfcLengthUnit.NameParameter), Is.EqualTo("FOOT"));
        Assert.That(project.GetParameterAsNumber(IfcLengthUnit.ScaleParameter), Is.EqualTo(0.3048).Within(1e-6));

        var axisTags = FindAllByCategory(bom, "IFCGRIDAXIS")
            .Select(e => e.GetParameterAsString(IfcToBosConverter.AxisTagParameter))
            .OrderBy(t => t)
            .ToList();
        Assert.That(axisTags, Is.EqualTo(new[] { "A", "B" }));
    }

    [Test]
    public static void SnowdonStructuralGivesFootAndPoint3048()
    {
        var directory = Environment.GetEnvironmentVariable("BIM_OPEN_SNOWDON_IFC")
            ?? "C:/Users/cdigg/git/3d-format-shootout/data/misc/Snowdon-IFC";
        var path = Path.Combine(directory, "Snowdon Towers Sample Structural.ifc");
        if (!File.Exists(path))
        {
            Assert.Ignore($"Snowdon Structural IFC not found at {path} (set BIM_OPEN_SNOWDON_IFC to override)");
            return;
        }

        var bimData = Convert(path);
        var bom = new BimObjectModel(bimData, true);

        var project = FindByCategory(bom, "IFCPROJECT");
        Assert.That(project, Is.Not.Null, "Expected an IFCPROJECT entity");
        Assert.That(project!.GetParameterAsString(IfcLengthUnit.NameParameter), Is.EqualTo("FOOT"));
        Assert.That(project.GetParameterAsNumber(IfcLengthUnit.ScaleParameter), Is.EqualTo(0.3048).Within(1e-6));
    }
}
