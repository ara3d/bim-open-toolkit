using Ara3D.BimOpenSchema;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using BimOpenFlow.Nodes.Ids;

namespace BimOpenFlow.Nodes.Ids.Tests;

/// <summary>ids.check and ids.specifications over in-memory entity and parameter tables (the
/// shape bos.load outputs) and an IDS written to a temporary file; no graph, no model file.</summary>
[TestFixture]
public sealed class IdsCheckNodeTests
{
    private const string Ids = """
        <?xml version="1.0" encoding="UTF-8"?>
        <ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">
          <info><title>doors</title></info>
          <specifications>
            <specification name="DC-W1" ifcVersion="IFC4" description="Door leaf width at least 850 mm">
              <applicability minOccurs="1" maxOccurs="unbounded"><entity><name><simpleValue>IFCDOOR</simpleValue></name></entity></applicability>
              <requirements><attribute><name><simpleValue>OverallWidth</simpleValue></name>
                <value><xs:restriction base="xs:double"><xs:minInclusive value="0.85"/></xs:restriction></value></attribute></requirements>
            </specification>
            <specification name="MAT" ifcVersion="IFC4">
              <applicability minOccurs="1" maxOccurs="unbounded"><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability>
              <requirements><material><value><simpleValue>concrete</simpleValue></value></material></requirements>
            </specification>
          </specifications>
        </ids>
        """;

    private string _idsPath = null!;

    [OneTimeSetUp]
    public void WriteIds()
    {
        _idsPath = Path.Combine(Path.GetTempPath(), "ids-check-" + Guid.NewGuid().ToString("N") + ".ids");
        File.WriteAllText(_idsPath, Ids);
    }

    [OneTimeTearDown]
    public void DeleteIds()
        => File.Delete(_idsPath);

    private static TableValue Entities()
        => NodeTestHelpers.Table(
            ("EntityIndex", typeof(long), [0L, 1L, 2L]),
            ("GlobalId", typeof(string), ["D1", "D2", "W1"]),
            ("Name", typeof(string), ["Door 1", "Door 2", "Wall 1"]),
            ("Category", typeof(string), ["IFCDOOR", "IFCDOOR", "IFCWALL"]));

    private static TableValue Parameters()
        => NodeTestHelpers.Table(
            ("EntityIndex", typeof(long), [0L, 1L]),
            ("Name", typeof(string), ["Ifc:OverallWidth", "Ifc:OverallWidth"]),
            ("ParameterGroup", typeof(string), ["IFCDOOR", "IFCDOOR"]),
            ("Units", typeof(string), [null, null]),
            ("ValueType", typeof(string), ["Number", "Number"]),
            ("Value", typeof(string), ["0.9", "0.8"]));

    /// <summary>The wall HasLayer a layer whose material is "Concrete" (entities 3 and 4).</summary>
    private static TableValue Relations()
        => NodeTestHelpers.Table(
            ("EntityIndexA", typeof(long), [2L, 3L]),
            ("NameA", typeof(string), ["Wall 1", null]),
            ("EntityIndexB", typeof(long), [3L, 4L]),
            ("NameB", typeof(string), [null, "concrete"]),
            ("RelationType", typeof(string), ["HasLayer", "HasMaterial"]));

    private static TableValue EntitiesWithMaterials()
        => NodeTestHelpers.Table(
            ("EntityIndex", typeof(long), [0L, 1L, 2L, 3L, 4L]),
            ("GlobalId", typeof(string), ["D1", "D2", "W1", null, null]),
            ("Name", typeof(string), ["Door 1", "Door 2", "Wall 1", null, "concrete"]),
            ("Category", typeof(string), ["IFCDOOR", "IFCDOOR", "IFCWALL", "IFCMATERIALLAYER", "IFCMATERIAL"]));

    private IReadOnlyList<FlowValue> Check(FakeEvalContext? context = null)
        => new IdsCheckNode().Eval(context ?? new FakeEvalContext(), [Entities(), Parameters()],
            NodeTestHelpers.Params(("ids", _idsPath)));

    [Test]
    public void Verdicts_OneRowPerEntityPerSpecification_WithTheIssueColumns()
    {
        var verdicts = ((TableValue)Check()[0]).Table;
        Assert.That(verdicts.ColumnNames(), Is.EqualTo(new[]
        {
            IssueColumns.GlobalId, IssueColumns.EntityIndex, IssueColumns.CheckId, IssueColumns.CheckTitle,
            IssueColumns.Citation, IssueColumns.Verdict, IssueColumns.Reason,
        }));
        Assert.That(verdicts.Rows, Has.Count.EqualTo(3), "two doors under DC-W1, one wall under MAT");
        Assert.That(verdicts.ColumnCells("Verdict"), Is.EqualTo(new object?[] { "Pass", "Fail", "InfoNotAvailable" }));
        Assert.That(verdicts.ColumnCells("GlobalId"), Is.EqualTo(new object?[] { "D1", "D2", "W1" }));
        Assert.That(verdicts.Cell("CheckTitle", 0), Is.EqualTo("Door leaf width at least 850 mm"));
        Assert.That((string?)verdicts.Cell("Reason", 1), Does.Contain("0.8"));
    }

    [Test]
    public void Summary_CountsPerSpecification()
    {
        var summary = ((TableValue)Check()[1]).Table;
        Assert.That(summary.ColumnNames(), Is.EqualTo(new[] { "CheckId", "CheckTitle", "Pass", "Fail", "InfoNotAvailable", "Rows" }));
        Assert.That(summary.ColumnCells("CheckId"), Is.EqualTo(new object?[] { "DC-W1", "MAT" }));
        Assert.That(summary.ColumnCells("Pass"), Is.EqualTo(new object?[] { 1L, 0L }));
        Assert.That(summary.ColumnCells("Fail"), Is.EqualTo(new object?[] { 1L, 0L }));
        Assert.That(summary.ColumnCells("InfoNotAvailable"), Is.EqualTo(new object?[] { 0L, 1L }));
    }

    [Test]
    public void RelationsInput_EvaluatesTheMaterialFacet()
    {
        var context = new FakeEvalContext();
        var outputs = new IdsCheckNode().Eval(context, [EntitiesWithMaterials(), Parameters(), Relations()],
            NodeTestHelpers.Params(("ids", _idsPath)));
        var verdicts = ((TableValue)outputs[0]).Table;
        Assert.That(verdicts.ColumnCells("Verdict"), Is.EqualTo(new object?[] { "Pass", "Fail", "Pass" }), "the wall's layer is concrete");
        Assert.That(context.Warnings, Has.None.Contains("material"));
    }

    [Test]
    public void UnsupportedFacet_WarnsOnTheNode()
    {
        var context = new FakeEvalContext();
        Check(context);
        Assert.That(context.Warnings, Has.Exactly(1).Contains("material"));
    }

    [Test]
    public void MisspelledFacet_WarnsOnTheNode()
    {
        var path = _idsPath + ".typo.ids";
        File.WriteAllText(path, Ids.Replace("<attribute>", "<atribute>").Replace("</attribute>", "</atribute>"));
        try
        {
            var context = new FakeEvalContext();
            new IdsCheckNode().Eval(context, [Entities(), Parameters()], NodeTestHelpers.Params(("ids", path)));
            Assert.That(context.Warnings, Has.Some.Contains("atribute"));
            var specs = new FakeEvalContext();
            new IdsSpecificationsNode().Eval(specs, [], NodeTestHelpers.Params(("ids", path)));
            Assert.That(specs.Warnings, Has.Some.Contains("atribute"));
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Test]
    public void MissingIdsFile_IsAnError()
        => Assert.That(() => new IdsCheckNode().Eval(new FakeEvalContext(), [Entities(), Parameters()],
            NodeTestHelpers.Params(("ids", _idsPath + ".missing"))), Throws.TypeOf<FileNotFoundException>());

    [Test]
    public void Specifications_ListsBothWithTheirSupport()
    {
        var table = new IdsSpecificationsNode().EvalTable([], ("ids", _idsPath));
        Assert.That(table.ColumnCells("CheckId"), Is.EqualTo(new object?[] { "DC-W1", "MAT" }));
        Assert.That(table.ColumnCells("Supported"), Is.EqualTo(new object?[] { true, true }), "material needs only the relations input");
        Assert.That((string?)table.Cell("Requirements", 0), Does.Contain("OverallWidth"));
    }

    [Test]
    public void Specs_DeclareThePortsAndTheIdsParameter()
    {
        var check = new IdsCheckNode().Spec;
        Assert.That(check.Inputs.Select(p => p.Name), Is.EqualTo(new[] { "entities", "parameters", "relations" }));
        Assert.That(check.Inputs.Select(p => p.Optional), Is.EqualTo(new[] { false, false, true }));
        Assert.That(check.Outputs.Select(p => p.Name), Is.EqualTo(new[] { "verdicts", "summary" }));
        Assert.That(check.Params.Single().Kind, Is.EqualTo(ParamKind.FilePath));
        Assert.That(IdsNodes.All.Select(n => n.Spec.Kind), Is.EqualTo(new[] { "ids.check", "ids.specifications" }));
    }
}
