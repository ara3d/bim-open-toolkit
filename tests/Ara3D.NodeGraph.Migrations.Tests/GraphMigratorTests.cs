namespace Ara3D.NodeGraph.Migrations.Tests;

[TestFixture]
public class GraphMigratorTests
{
    /// <summary>A fake migration that records when it ran and rewrites the document.</summary>
    private sealed class SampleMigration : IGraphMigration
    {
        private readonly List<string> _log;
        private readonly Func<string, string> _transform;

        public SampleMigration(string from, string to, List<string> log, Func<string, string> transform)
            => (FromVersion, ToVersion, _log, _transform) = (from, to, log, transform);

        public string FromVersion { get; }
        public string ToVersion { get; }

        public string Migrate(string documentJson)
        {
            _log.Add($"{FromVersion}->{ToVersion}");
            return _transform(documentJson);
        }
    }

    private static readonly string MinimalCurrentJson =
        """{"formatVersion":"0.1.0","structure":{"nodes":[],"edges":[]},"values":{}}""";

    [Test]
    public void AlreadyCurrent_ReturnsInputByteIdentical()
    {
        var input = MinimalCurrentJson;
        Assert.That(GraphMigrator.Current.MigrateToCurrent(input), Is.EqualTo(input));
    }

    [Test]
    public void AlreadyCurrent_NonCanonicalTextIsNotTouched()
    {
        var input = "  {  \"formatVersion\" : \"0.1.0\", \"values\":{}, \"structure\":{\"nodes\":[],\"edges\":[]} }  ";
        Assert.That(GraphMigrator.Current.MigrateToCurrent(input), Is.EqualTo(input));
    }

    [Test]
    public void MissingFormatVersion_TreatedAsCurrent()
    {
        var input = """{"structure":{"nodes":[],"edges":[]},"values":{}}""";
        Assert.That(GraphMigrator.Current.MigrateToCurrent(input), Is.EqualTo(input));
    }

    [Test]
    public void ChainedMigrations_AppliedInOrder_AndOutputIsCanonical()
    {
        var log = new List<string>();
        var migrator = new GraphMigrator(new IGraphMigration[]
        {
            // Registered out of order on purpose: chaining goes by FromVersion.
            new SampleMigration("0.0.2", "0.1.0", log, _ => MinimalCurrentJson),
            new SampleMigration("0.0.1", "0.0.2", log, _ => """{"formatVersion":"0.0.2","legacy":true}"""),
        });

        var result = migrator.MigrateToCurrent("""{"formatVersion":"0.0.1","ancient":123}""");

        Assert.That(log, Is.EqualTo(new[] { "0.0.1->0.0.2", "0.0.2->0.1.0" }));
        Assert.That(result, Is.EqualTo(GraphDocumentIO.Parse(MinimalCurrentJson).ToCanonicalJson()));
    }

    [Test]
    public void NewerVersion_IsRejected()
    {
        var input = """{"formatVersion":"0.2.0","structure":{"nodes":[],"edges":[]},"values":{}}""";
        var ex = Assert.Throws<FormatException>(() => GraphMigrator.Current.MigrateToCurrent(input));
        Assert.That(ex!.Message, Does.Contain("newer").And.Contain("0.2.0"));
    }

    [Test]
    public void UnknownOlderVersion_WithNoMigration_IsRejected()
    {
        var input = """{"formatVersion":"0.0.9","structure":{"nodes":[],"edges":[]},"values":{}}""";
        var ex = Assert.Throws<FormatException>(() => GraphMigrator.Current.MigrateToCurrent(input));
        Assert.That(ex!.Message, Does.Contain("0.0.9"));
    }

    [Test]
    public void InvalidVersionString_IsRejected()
    {
        var input = """{"formatVersion":"banana"}""";
        var ex = Assert.Throws<FormatException>(() => GraphMigrator.Current.MigrateToCurrent(input));
        Assert.That(ex!.Message, Does.Contain("banana"));
    }

    [Test]
    public void MalformedJson_IsRejected()
    {
        var ex = Assert.Throws<FormatException>(() => GraphMigrator.Current.MigrateToCurrent("{not json"));
        Assert.That(ex!.Message, Does.Contain("not valid JSON"));
    }

    [Test]
    public void ProductionRegistry_IsEmpty()
        => Assert.That(GraphMigrator.Current.Migrations, Is.Empty);
}
