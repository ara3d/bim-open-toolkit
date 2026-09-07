using Ara3D.BimOpenSchema.BuildingModel;
using Ara3D.BimOpenSchema.BuildingModel.Workflows.Operations;
using Platonic;
using static Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests.Operations.Examples;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests.Operations;

[Impure, TestFixture, Category("Source.Synthetic"), Category("Size.Small")]
public sealed class CommercialTests
{
    [Test]
    public void EstimateRoundsLinesAndKeepsScenarioChangesIndependent()
    {
        var line = Cost("scope", Known(3m)) with { Waste = Known(new Ratio(0.1)), Rate = Known(Rate(12.345m)) };
        var request = new EstimateRequest(Package(), Scenario(), "CAD", [Catalog()], [line], Completeness.Complete);
        var first = OperationsWorkflows.Estimate(request);
        var second = OperationsWorkflows.Estimate(request with { Scenario = Scenario("2"), Lines = [line with { Waste = Known(new Ratio(0)) }] });
        Assert.That(Value(first.Summary.TotalCost).Amount, Is.EqualTo(40.74m));
        Assert.That(Value(second.Summary.TotalCost).Amount, Is.EqualTo(37.04m));
        Assert.That(first.Summary.ScenarioId, Is.Not.EqualTo(second.Summary.ScenarioId));
        Assert.That(ModelChecks.Validate(first.Lines[0]), Is.Empty);
        Assert.That(ModelChecks.Validate(first.Summary), Is.Empty);
    }

    [Test]
    public void KnownZeroPricesButMissingQuantityAndWasteDoNot()
    {
        var result = OperationsWorkflows.Estimate(new(Package(), Scenario(), "CAD", [Catalog()],
            [Cost("zero", Known(0m)), Cost("missing", Unknown<decimal>()), Cost("waste", Known(2m)) with { Waste = Unknown<Ratio>() }], Completeness.Complete));
        Assert.That(Value(result.Lines[0].TotalCost).Amount, Is.Zero);
        Assert.That(result.Lines[1].TotalCost, Is.TypeOf<Fact<Money>.Missing>());
        Assert.That(result.Lines[2].TotalCost, Is.TypeOf<Fact<Money>.Missing>());
        Assert.That(result.Summary.PricedLineCount, Is.EqualTo(1));
        Assert.That(result.Summary.TotalCost, Is.TypeOf<Fact<Money>.Missing>());
    }

    [Test]
    public void IncompatibleUnitsAndCurrenciesStayOutOfSupportedSubtotal()
    {
        var usdCatalog = Catalog() with { Currency = "USD", Id = Ref<RateCatalog>("usd") };
        var usd = Rate(99, currency: "USD") with { CatalogId = usdCatalog.Id };
        var result = OperationsWorkflows.Estimate(new(Package(), Scenario(), "CAD", [Catalog(), usdCatalog],
            [Cost("good", Known(2m)), Cost("unit", Known(1m)) with { Rate = Known(Rate(100, QuantityUnit.SquareMetre)) },
                Cost("currency", Known(1m)) with { Rate = Known(usd) }], Completeness.Complete));
        Assert.That(Value(result.Summary.KnownSubtotal).Amount, Is.EqualTo(20m));
        Assert.That(result.Summary.UnpricedLineCount, Is.EqualTo(2));
    }

    [Test]
    public void DuplicateScopeAndInvalidQuantityAreRejected()
    {
        var request = new EstimateRequest(Package(), Scenario(), "CAD", [Catalog()], [Cost("a", Known(1m)), Cost("b", Known(2m)) with { ExclusiveScope = "a" }], Completeness.Complete);
        Assert.Throws<ArgumentException>(() => OperationsWorkflows.Estimate(request));
        Assert.Throws<ArgumentException>(() => OperationsWorkflows.Estimate(request with { Lines = [Cost("a", Known(-1m))] }));
    }

    [Test]
    public void ReceiptReingestionIsIdempotentAndCorrectionReplacesEarlierQuantity()
    {
        var first = new ReceiptRevision("receipt-line", 0, Receipt("line", 5, 4), Unknown<string>());
        var correction = first with { Revision = 1, Line = Receipt("line-corrected", 5, 3) };
        var second = new ReceiptRevision("second-line", 0, Receipt("second", 4, 4), Unknown<string>());
        var repeatedIngestion = new ReceiptRevision("receipt-line", 0, Receipt("line", 5, 4), Unknown<string>());
        var request = new ReconciliationRequest(Requirement(), [first, repeatedIngestion, correction, second], [], Completeness.Complete, Completeness.NotObserved);
        var result = OperationsWorkflows.Reconcile(request);
        Assert.That(Value(result.AcceptedSubtotal), Is.EqualTo(7m));
        Assert.That(Value(result.ReceivedSubtotal), Is.EqualTo(9m));
        Assert.That(Value(result.NotAcceptedSubtotal), Is.EqualTo(2m));
        Assert.That(Value(result.OutstandingAgainstKnownReceipts), Is.EqualTo(3m));
        Assert.That(result.ReceiptHistory.Length, Is.EqualTo(3));
        Assert.That(result.LatestInstallation, Is.Empty);
        Assert.That(result.InstallationCoverage, Is.EqualTo(Completeness.NotObserved));
    }

    [Test]
    public void SubstitutionNeedsRecordedAcceptanceAndDeliveryDoesNotEstablishInstallation()
    {
        var replacement = new ReceiptRevision("substitute", 0, Receipt("line", 10, 10) with { ProductId = Known(Ref<ProductDefinition>("alternative")) }, Unknown<string>());
        var request = new ReconciliationRequest(Requirement(), [replacement], [], Completeness.Complete, Completeness.NotObserved);
        Assert.That(Value(OperationsWorkflows.Reconcile(request).AcceptedSubtotal), Is.Zero);
        var accepted = OperationsWorkflows.Reconcile(request with { Receipts = [replacement with { AcceptedSubstitutionBasis = Known("Architect decision ABC") }] });
        Assert.That(Value(accepted.AcceptedSubtotal), Is.EqualTo(10m));
        Assert.That(accepted.LatestInstallation, Is.Empty);
    }

    [Test]
    public void LaterInstallationCorrectionPreservesHistory()
    {
        var installed = Installed("installed", DateTimeOffset.Parse("2026-01-01T10:00:00Z"), InstallationState.Installed);
        var corrected = Installed("correction", DateTimeOffset.Parse("2026-01-02T10:00:00Z"), InstallationState.ReworkRequired);
        var result = OperationsWorkflows.Reconcile(new(Requirement(), [], [installed, corrected], Completeness.NotObserved, Completeness.Complete));
        Assert.That(result.LatestInstallation.Single().State, Is.EqualTo(InstallationState.ReworkRequired));
        Assert.That(result.InstallationHistory.Length, Is.EqualTo(2));
    }

    [Test]
    public void ConflictingReceiptRevisionAndIncompatibleUnitAreRejected()
    {
        var first = new ReceiptRevision("receipt", 0, Receipt("line", 5, 5), Unknown<string>());
        var request = new ReconciliationRequest(Requirement(), [first, first with { Line = first.Line with { AcceptedQuantity = Known(4m) } }], [], Completeness.Complete, Completeness.NotObserved);
        Assert.Throws<ArgumentException>(() => OperationsWorkflows.Reconcile(request));
        Assert.Throws<ArgumentException>(() => OperationsWorkflows.Reconcile(request with { Receipts = [first with { Line = first.Line with { Unit = QuantityUnit.SquareMetre } }] }));
    }
}
