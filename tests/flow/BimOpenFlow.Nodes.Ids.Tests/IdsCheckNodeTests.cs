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
    public void UnsupportedFacet_WarnsOnTheNode()
    {
        var context = new FakeEvalContext();
        Check(context);
        Assert.That(context.Warnings, Has.Exactly(1).Contains("material"));
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
        Assert.That(table.ColumnCells("Supported"), Is.EqualTo(new object?[] { true, false }));
        Assert.That((string?)table.Cell("Requirements", 0), Does.Contain("OverallWidth"));
    }

    [Test]
    public void Specs_DeclareThePortsAndTheIdsParameter()
    {
        var check = new IdsCheckNode().Spec;
        Assert.That(check.Inputs.Select(p => p.Name), Is.EqualTo(new[] { "entities", "parameters" }));
        Assert.That(check.Outputs.Select(p => p.Name), Is.EqualTo(new[] { "verdicts", "summary" }));
        Assert.That(check.Params.Single().Kind, Is.EqualTo(ParamKind.FilePath));
        Assert.That(IdsNodes.All.Select(n => n.Spec.Kind), Is.EqualTo(new[] { "ids.check", "ids.specifications" }));
    }
}
