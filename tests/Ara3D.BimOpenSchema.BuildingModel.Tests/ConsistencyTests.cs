using Platonic;
using static Ara3D.BimOpenSchema.BuildingModel.Tests.Examples;

namespace Ara3D.BimOpenSchema.BuildingModel.Tests;

[Impure, TestFixture, Category("Size.Small"), Category("Stage.Review"), Category("Source.Synthetic")]
public sealed class ConsistencyTests
{
    [Test, Category("Feature.Connectivity"), Category("Workflow.MepTrace")]
    public void TraversalCanSelectDeclaredConnectionsWithoutPromotingInferredOnes()
    {
        var declared = new ServiceConnection(Key<ServiceConnection>("declared"), Key<ServicePort>("valve-out"),
            Key<ServicePort>("pipe-in"), ConnectionBasis.SourceDeclared, Known("Physical coupling"), Unknown<bool>(), Ref<Evidence>("source-topology"));
        var inferred = declared with { Id = Key<ServiceConnection>("inferred"), PortBId = Key<ServicePort>("other-pipe"), Basis = ConnectionBasis.Inferred };
        var accepted = new[] { declared, inferred }.Where(c => c.Basis is ConnectionBasis.SourceDeclared or ConnectionBasis.Verified).ToArray();
        Assert.That(accepted.Select(c => c.Id), Is.EqualTo(new[] { declared.Id }));
        Assert.That(accepted.Single().IsOperational, Is.TypeOf<Fact<bool>.Missing>(), "A design connection alone does not prove current operational availability.");
    }

    [Test, Category("Feature.Evidence"), Category("Workflow.Auditing")]
    public void DefaultStatesCannotAccidentallyAssertApprovalOrCompleteCoverage()
    {
        Assert.That(default(AssessmentOutcome), Is.EqualTo(AssessmentOutcome.Unknown));
        Assert.That(default(Completeness), Is.EqualTo(Completeness.NotObserved));
        Assert.That(default(Reachability), Is.EqualTo(Reachability.Unknown));
        Assert.That(default(QuantitySelection), Is.EqualTo(QuantitySelection.Unresolved));
        Assert.That(default(ContributionRole), Is.EqualTo(ContributionRole.Unresolved));
        Assert.That(default(CorrespondenceStatus), Is.EqualTo(CorrespondenceStatus.Candidate));
        Assert.That(default(PricingState), Is.EqualTo(PricingState.Unpriced));
    }

    [Test, Category("Feature.Cost"), Category("Workflow.Estimating")]
    public void KnownSubtotalCanSurviveAnUnpricedScopeButCompleteTotalCannot()
    {
        var partial = Estimate() with { UnpricedLineCount = 1, Coverage = Completeness.Partial, TotalCost = Unknown<Money>() };
        Assert.That(ModelChecks.Validate(partial), Is.Empty);
        Assert.That(partial.KnownSubtotal, Is.TypeOf<Fact<Money>.Known>());
        var misleading = partial with { TotalCost = Known(new Money(2750m, "CAD")) };
        Assert.That(ModelChecks.Validate(misleading).Select(x => x.Code), Does.Contain("estimate.incomplete-total"));
        Assert.That(ModelChecks.Validate(misleading).Select(x => x.Code), Does.Contain("estimate.unresolved-total"));
    }

    [Test, Category("Feature.Cost"), Category("Workflow.Estimating")]
    public void UnpricedLineCannotBeReportedAsAnExplicitZeroCost()
    {
        var unpriced = PricedLine() with { PricingState = PricingState.Unpriced, AppliedUnitPrice = Unknown<Money>(), TotalCost = Unknown<Money>() };
        Assert.That(ModelChecks.Validate(unpriced), Is.Empty);
        Assert.That(ModelChecks.Validate(unpriced with { TotalCost = Known(new Money(0, "CAD")) }).Single().Code,
            Is.EqualTo("estimate.unpriced-total"));
    }

    [Test, Category("Feature.Cost"), Category("Workflow.Estimating")]
    public void CurrencyMismatchAndUnknownWasteCannotHideInsidePricedLine()
    {
        Assert.That(ModelChecks.Validate(PricedLine()), Is.Empty);
        var bad = PricedLine() with { WasteFraction = Unknown<Ratio>(), TotalCost = Known(new Money(2750, "USD")) };
        Assert.That(ModelChecks.Validate(bad).Select(v => v.Code), Is.EquivalentTo(new[] { "estimate.missing-waste", "estimate.currency-mismatch" }));
        Assert.That(ModelChecks.Validate(PricedLine() with { WasteFraction = Known(new Ratio(-0.1)) }).Single().Code,
            Is.EqualTo("estimate.invalid-waste"));
    }

    [Test, Category("Feature.Cost"), Category("Workflow.Estimating")]
    public void ContradictoryCoverageAndNegativeCountsAreReportedWithoutThrowing()
    {
        var bad = Estimate() with { PricedLineCount = -1, UnpricedLineCount = 2 };
        Assert.That(ModelChecks.Validate(bad).Select(v => v.Code), Does.Contain("estimate.negative-count"));
        Assert.That(ModelChecks.Validate(bad).Select(v => v.Code), Does.Contain("estimate.contradictory-coverage"));
    }

    [TestCase(Completeness.Partial), TestCase(Completeness.NotObserved), TestCase(Completeness.NotApplicable)]
    [Category("Feature.Assessment"), Category("Workflow.Auditing")]
    public void PassRequiresCompleteRelevantEvidenceButConclusiveFailureDoesNot(Completeness coverage)
    {
        Assert.That(ModelChecks.Validate(Assessment(AssessmentOutcome.Pass, coverage)).Single().Code,
            Is.EqualTo("assessment.incomplete-pass"));
        Assert.That(ModelChecks.Validate(Assessment(AssessmentOutcome.Fail, coverage)), Is.Empty);
        Assert.That(ModelChecks.Validate(Assessment(AssessmentOutcome.Unknown, coverage)), Is.Empty);
        Assert.That(ModelChecks.Validate(Assessment(AssessmentOutcome.Pass, Completeness.Complete)), Is.Empty);
    }

    [Test, Category("Feature.Assessment"), Category("Workflow.Egress")]
    public void EgressResultRetainsItsRequirementAndUnresolvedRoute()
    {
        var result = new EgressAssessment(Key<EgressAssessment>("egress-1"), Key<EgressStudy>("study-1"),
            Unknown<SnapshotKey<EgressRoute>>(), Ref<Requirement>("travel-distance"), AssessmentOutcome.Unknown,
            Completeness.Partial, Unknown<Length>(), Unknown<Length>(), "No routing method executed", "Door connectivity unavailable", []);
        Assert.That(ModelChecks.Validate(result), Is.Empty);
        Assert.That(ModelChecks.Validate(result with { Outcome = AssessmentOutcome.Pass }).Single().Code, Is.EqualTo("assessment.incomplete-pass"));
    }

    [Test, Category("Feature.Geometry"), Category("Workflow.Coordination")]
    public void BoundingBoxOverlapDoesNotEstablishEvenZeroSolidOverlap()
    {
        Assert.That(ModelChecks.Validate(BoundsCandidate()), Is.Empty);
        var bad = BoundsCandidate() with { IntersectionVolume = Known(new Volume(0)) };
        Assert.That(ModelChecks.Validate(bad).Single().Code, Is.EqualTo("spatial.bounds-not-solid"));
    }

    [TestCase(-0.001), TestCase(double.NaN), TestCase(double.PositiveInfinity)]
    [Category("Feature.Geometry"), Category("Workflow.Coordination")]
    public void SpatialToleranceMustBeFiniteAndNonnegative(double tolerance)
    {
        Assert.That(ModelChecks.Validate(BoundsCandidate() with { Tolerance = new Length(tolerance) }).Single().Code,
            Is.EqualTo("spatial.invalid-tolerance"));
    }

    [TestCase(Completeness.Partial, false), TestCase(Completeness.NotObserved, false), TestCase(Completeness.Complete, true)]
    [Category("Feature.Connectivity"), Category("Workflow.MepTrace")]
    public void IncompleteOrTruncatedTraceCannotProvePhysicalDisconnection(Completeness coverage, bool truncated)
    {
        var trace = Trace(coverage, truncated);
        Assert.That(ModelChecks.Validate(TraceMember(Reachability.Unknown), trace), Is.Empty);
        Assert.That(ModelChecks.Validate(TraceMember(Reachability.NotReachableWithinCompleteScope), trace).Single().Code,
            Is.EqualTo("trace.unsupported-nonreachability"));
        Assert.That(ModelChecks.Validate(TraceMember(Reachability.Established), trace), Is.Empty);
    }

    [Test, Category("Feature.Connectivity"), Category("Workflow.MepTrace")]
    public void TraceMembersCannotReferToAConnectionFromAnotherIssue()
    {
        var member = TraceMember(Reachability.Established) with { ViaConnectionId = Known(Key<ServiceConnection>("connection-1", "other-issue")) };
        Assert.That(ModelChecks.Validate(member, Trace(Completeness.Complete)).Single().Code, Is.EqualTo("trace.snapshot-mismatch"));
        var wrongOwner = TraceMember(Reachability.Unknown) with { TraceId = Key<ServiceTraceResult>("different-trace") };
        Assert.That(ModelChecks.Validate(wrongOwner, Trace(Completeness.Complete)).Single().Code, Is.EqualTo("trace.wrong-owner"));
    }
}
