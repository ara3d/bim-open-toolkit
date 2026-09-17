using Ara3D.BimOpenSchema.IO;
using Ara3D.Utils;

namespace Ara3D.BimOpenSchema.DuckDb.Tests;

/// <summary>Exercises the file-database path against a real model. Skipped (not failed) when the
/// sample data folder is absent, so the suite still runs on a bare checkout.</summary>
[TestFixture]
[Category("RequiresData")]
public sealed class IfcModelTests
{
    public const string FzkHaus = "AC20-FZK-Haus.ifc";

    private static string RequirePath(string fileName)
    {
        var dir = new DirectoryInfo(TestContext.CurrentContext.TestDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "data", fileName);
            if (File.Exists(candidate))
                return candidate;
            dir = dir.Parent;
        }

        Assert.Ignore($"Sample model {fileName} not found under a 'data' folder.");
        return "";
    }

    [Test]
    public void FzkHaus_ConvertsAndAnswersViewQueries()
    {
        var ifc = RequirePath(FzkHaus);
        var folder = Path.Combine(Path.GetTempPath(), "ara3d-duckdb-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        try
        {
            var bos = new FilePath(Path.Combine(folder, "model.bos"));
            var db = new FilePath(Path.Combine(folder, "model.duckdb"));

            var converter = new IfcToBosConverter(new FilePath(ifc));
            try
            {
                converter.SaveToBos(bos);
            }
            finally
            {
                converter.IfcFile?.Dispose();
            }

            bos.BosToDuckDB(db);
            BosDuckDbViews.CreateViews(db);

            using var conn = BosDuckDb.Open(db);
            Assert.That(conn.ScalarInt64("SELECT count(*) FROM EntityText"), Is.GreaterThan(100));
            Assert.That(conn.ScalarInt64("SELECT count(*) FROM ParameterText WHERE Value IS NOT NULL"), Is.GreaterThan(100));
            Assert.That(conn.ScalarInt64("SELECT count(*) FROM RelationText"), Is.GreaterThan(10));
        }
        finally
        {
            BosDuckDbTests.TryDelete(folder);
        }
    }
}
