using System.Collections.Immutable;
using System.Text;
using System.Text.Json;
using Ara3D.BimOpenSchema.BuildingModel.Workflows.IO;
using Platonic;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

[Impure, TestFixture]
public sealed class PersistenceTests
{
    [Test]
    public void ExplicitFactTagsPreserveKnownZeroFalseMissingReasonsAndEvidence()
    {
        var options = ProjectionStore.Options();
        Fact<Length> length = new Fact<Length>.Known(new(0), Assurance.Observed, [new("evidence-a")]);
        var recovered = JsonSerializer.Deserialize<Fact<Length>>(JsonSerializer.Serialize(length, options), options);
        Assert.That(recovered, Is.TypeOf<Fact<Length>.Known>());
        var known = (Fact<Length>.Known)recovered!;
        Assert.That(known.Value.Metres, Is.Zero);
        Assert.That(known.Evidence.Single().Value, Is.EqualTo("evidence-a"));
        Fact<bool> boolean = new Fact<bool>.Known(false, Assurance.Verified, []);
        Assert.That(((Fact<bool>.Known)JsonSerializer.Deserialize<Fact<bool>>(JsonSerializer.Serialize(boolean, options), options)!).Value, Is.False);
        foreach (var reason in Enum.GetValues<Availability>())
        {
            Fact<Length> missing = new Fact<Length>.Missing(reason, "explicit explanation", [new("evidence-b")]);
            var result = (Fact<Length>.Missing)JsonSerializer.Deserialize<Fact<Length>>(JsonSerializer.Serialize(missing, options), options)!;
            Assert.That(result.Reason, Is.EqualTo(reason));
            Assert.That(result.Explanation, Is.EqualTo("explicit explanation"));
            Assert.That(result.Evidence.Single().Value, Is.EqualTo("evidence-b"));
        }
    }

    [Test]
    public void KeysRoundTripThroughValidatedConstructorsAndRetainSnapshotIdentity()
    {
        var options = ProjectionStore.Options();
        Fact<SnapshotKey<Space>> link = new Fact<SnapshotKey<Space>>.Known(new(new("snapshot-a"), "same/local"), Assurance.Observed, []);
        var result = (Fact<SnapshotKey<Space>>.Known)JsonSerializer.Deserialize<Fact<SnapshotKey<Space>>>(JsonSerializer.Serialize(link, options), options)!;
        Assert.That(result.Value.SnapshotId.Value, Is.EqualTo("snapshot-a"));
        Assert.That(result.Value.Value, Is.EqualTo("same/local"));
        Assert.That(result.Value, Is.Not.EqualTo(new SnapshotKey<Space>(new("snapshot-b"), "same/local")));
        Assert.Throws<JsonException>(() => JsonSerializer.Serialize(default(ReferenceKey<Space>), options));
        Assert.Throws<ArgumentException>(() => JsonSerializer.Deserialize<ReferenceKey<Space>>("\"\"", options));
    }

    [Test]
    public void UnknownFactStateAndNullFactCannotSilentlyBecomeUnknown()
    {
        var options = ProjectionStore.Options();
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Fact<int>>("null", options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Fact<int>>("{\"state\":\"guessed\",\"evidence\":[]}", options));
        Assert.Throws<JsonException>(() => JsonSerializer.Serialize<Fact<int>>(null!, options));
    }

    [Test]
    public void VersionedProjectionReopensAndRejectsUnknownVersion()
    {
        var projection = Empty();
        using var bytes = new MemoryStream();
        ProjectionStore.Write(projection, bytes);
        bytes.Position = 0;
        var recovered = ProjectionStore.Read(bytes);
        Assert.That(recovered.Snapshot.Id, Is.EqualTo(projection.Snapshot.Id));
        Assert.That(recovered.Snapshot.SchemaVersion, Is.EqualTo("review-test"));
        var text = Encoding.UTF8.GetString(bytes.ToArray()).Replace("\"Version\":1", "\"Version\":99", StringComparison.Ordinal);
        using var unsupported = new MemoryStream(Encoding.UTF8.GetBytes(text));
        Assert.Throws<InvalidDataException>(() => ProjectionStore.Read(unsupported));
    }

    [Test]
    public void ProjectionRejectsDuplicatePhysicalIdentities()
    {
        var row = new BimObject(new("object-a"), IdentityStatus.Provisional, "fixture", [], []);
        Assert.Throws<InvalidDataException>(() => ProjectionStore.Validate(Empty() with { Objects = [row, row] }));
    }

    [Test]
    public void PortfolioCollapsesRepeatedSnapshotSelectionWithoutSummingSources()
    {
        var report = PortfolioWorkflows.Compare([Empty(), Empty()]);
        Assert.That(report.Rows.Length, Is.EqualTo(1));
        Assert.That(report.Findings.Any(x => x.Contains("Duplicate snapshot", StringComparison.Ordinal)), Is.True);
        Assert.That(report.Status, Is.EqualTo(WorkflowStatus.Partial));
    }

    private static BuildingProjection Empty() => new(
        new(new("snapshot-a"), "fixture", "review-test", [], [], DateTimeOffset.UnixEpoch),
        [], [], [], [], [], [], [], [], [], [], [], [], []);
}
