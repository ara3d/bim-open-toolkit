using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Pipes, fittings, valves, sanitary fixtures, drains, pumps, fire protection terminals and piping systems. Wave R5 track F; see WAVE-R5.md.</summary>
public static class PlumbingMapping
{
    public static readonly DomainMapping Domain = new("Plumbing",
    [
        new("Pipes", "PipeSegment"), new("Flex Pipes", "PipeSegment"), new("IFCPIPESEGMENT", "PipeSegment"),
        new("Pipe Fittings", "PipeFitting"), new("IFCPIPEFITTING", "PipeFitting"),
        new("IFCVALVE", "Valve"),
        new("Plumbing Fixtures", "SanitaryFixture"), new("IFCSANITARYTERMINAL", "SanitaryFixture"),
        new("Sprinklers", "FireProtectionTerminal"), new("IFCFIRESUPPRESSIONTERMINAL", "FireProtectionTerminal"),
        new("IFCPUMP", "Pump"),
        new("IFCWASTETERMINAL", "Drain"),
        new("Piping Systems", "ServiceSystem")
    ],
    ["Mechanical", "Insulation"],
    Map, Complete);

    private static void Map(MappingKernel k, EntityRow e, string kind, ProjectionBuilder b)
    {
        if (kind == "ServiceSystem")
        {
            b.Add(BuildServiceSystem(k, e));
            return;
        }
        var element = k.Element(e);
        switch (kind)
        {
            case "PipeSegment": b.Add(BuildPipeSegment(k, e, element)); break;
            case "PipeFitting": b.Add(BuildPipeFitting(k, e, element)); break;
            case "Valve": b.Add(BuildValve(k, e, element)); break;
            case "SanitaryFixture": b.Add(BuildSanitaryFixture(k, e, element)); break;
            case "FireProtectionTerminal": b.Add(BuildFireProtectionTerminal(k, e, element)); break;
            case "Pump": b.Add(BuildPump(k, e, element)); break;
            case "Drain": b.Add(BuildDrain(k, e, element)); break;
        }
    }

    // Flow, pressure and temperature are not convertible from a Revit-internal number by this kernel; the unit keys
    // below are unfamiliar to it on purpose, so the fact stays unavailable rather than guessed.
    private static Fact<FlowRate> ReadFlow(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Number(e, field, "m3/s", x => new FlowRate(x), false, aliases);

    private static Fact<Pressure> ReadPressure(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Number(e, field, "Pa", x => new Pressure(x), false, aliases);

    private static Fact<Temperature> ReadTemperature(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Number(e, field, "K", x => new Temperature(x), false, aliases);

    private static Fact<SnapshotKey<ServiceSystem>> SystemId(MappingKernel k, EntityRow e)
        => k.Reference<ServiceSystem>(e, "SystemId", "System Type");

    private static Fact<SnapshotKey<Space>> SpaceId(MappingKernel k, EntityRow e)
        => k.Reference<Space>(e, "SpaceId", "Rvt:FamilyInstance:Room", "Rvt:FamilyInstance:Space");

    // Reference<T> only builds SnapshotKey<T> targets; a material's identity is a global ReferenceKey<T> owned by
    // track H's Materials rows, so its resolution is written directly on top of Resolve/Select.
    private static Fact<ReferenceKey<Material>> MaterialReference(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Resolve<ReferenceKey<Material>>(e, field, k.Select(e, ParameterType.Entity, aliases),
            p => p.ReferenceEntityId is { } id && k.Kind(id) == "Material"
                ? new Fact<ReferenceKey<Material>>.Known(new(k.Identity(id).Value), Assurance.Observed, [])
                : new Fact<ReferenceKey<Material>>.Missing(Availability.Invalid, "Source reference target is outside the mapped Material table.", []));

    // Revit stores slope as a dimensionless rise/run ratio; a descriptor carrying its own explicit units is a
    // different quantity (for example rise per 12 inches) and is never reinterpreted as a bare ratio.
    private static Fact<Ratio> Slope(MappingKernel k, EntityRow e)
        => k.Resolve<Ratio>(e, "Slope", k.Select(e, ParameterType.Number, "Slope"), p => string.IsNullOrEmpty(p.Units)
            ? p.NumberValue is { } value && double.IsFinite(value)
                ? new Fact<Ratio>.Known(new(value), Assurance.Observed, [])
                : new Fact<Ratio>.Missing(Availability.Invalid, "Slope value is not a finite number.", [])
            : Fact<Ratio>.Unknown("Slope descriptor carries explicit units; dimensionless rise/run is not established."));

    private static PipeSegment BuildPipeSegment(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<PipeSegment>(e), element, SystemId(k, e),
            k.Text(e, "NominalSize", "Size"),
            k.Number(e, "OutsideDiameter", "m", x => new Length(x), false, "Outside Diameter"),
            k.Number(e, "InsideDiameter", "m", x => new Length(x), false, "Inside Diameter"),
            k.Number(e, "CenterlineLength", "m", x => new Length(x), false, "Length"),
            MaterialReference(k, e, "MaterialId", "Material"),
            k.Number(e, "WallThickness", "m", x => new Length(x), false, "Wall Thickness"),
            k.Number(e, "InsulationThickness", "m", x => new Length(x), false, "Insulation Thickness"),
            Slope(k, e),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            ReadPressure(k, e, "PressureRating", "Pressure Rating"),
            LinkSet<ServicePort>.Unknown());

    private static PipeFitting BuildPipeFitting(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<PipeFitting>(e), element, SystemId(k, e), FittingFunction.Unknown,
            MaterialReference(k, e, "MaterialId", "Material"),
            k.Number(e, "BendAngle", "rad", x => new Angle(x), true, "Angle"),
            k.Number(e, "CenterlineRadius", "m", x => new Length(x), false, "Center Radius"),
            ReadPressure(k, e, "PressureRating", "Pressure Rating"),
            LinkSet<ServicePort>.Unknown());

    private static Valve BuildValve(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<Valve>(e), element, SystemId(k, e), ValveFunction.Unknown,
            k.Text(e, "NominalSize", "Size"),
            MaterialReference(k, e, "MaterialId", "Material"),
            k.Text(e, "Actuation", "Actuation"),
            k.Text(e, "NormalPosition", "Normal Position"),
            k.Text(e, "FailPosition", "Fail Position"),
            ReadPressure(k, e, "PressureRating", "Pressure Rating"),
            ReadPressure(k, e, "SetPressure", "Set Pressure"),
            LinkSet<ServicePort>.Unknown());

    private static SanitaryFixture BuildSanitaryFixture(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<SanitaryFixture>(e), element, SanitaryFixtureKind.Unknown,
            SpaceId(k, e),
            k.Text(e, "Mounting", "Mounting"),
            k.Number(e, "RimHeight", "m", x => new Length(x), false, "Rim Height"),
            ReadFlow(k, e, "ColdWaterDemand", "Cold Water Demand"),
            ReadFlow(k, e, "HotWaterDemand", "Hot Water Demand"),
            k.Number(e, "WasteOutletDiameter", "m", x => new Length(x), false, "Sanitary Diameter"),
            k.Text(e, "AccessibilityDesignation", "Accessibility Designation"),
            k.Text(e, "Finish", "Finish"),
            LinkSet<ServicePort>.Unknown());

    private static FireProtectionTerminal BuildFireProtectionTerminal(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<FireProtectionTerminal>(e), element, FireProtectionTerminalKind.Unknown, SystemId(k, e),
            SpaceId(k, e),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            ReadPressure(k, e, "RequiredPressure", "Required Pressure"),
            ReadTemperature(k, e, "ActivationTemperature", "Activation Temperature"),
            k.Number(e, "CoverageArea", "m2", x => new Area(x), false, "Coverage Area"),
            k.Text(e, "Orientation", "Orientation"),
            LinkSet<ServicePort>.Unknown());

    private static Pump BuildPump(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<Pump>(e), element, SystemId(k, e),
            k.Text(e, "PumpType", "Pump Type"),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            ReadPressure(k, e, "PressureRise", "Pressure Rise"),
            k.Number(e, "ElectricalInput", "W", x => new Power(x), false, "Electrical Input"),
            k.Number(e, "Efficiency", "ratio", x => new Ratio(x), false, "Efficiency"),
            k.Flag(e, "VariableSpeed", "Variable Speed"),
            k.Text(e, "DutyRole", "Duty Role"),
            LinkSet<ServicePort>.Unknown());

    private static Drain BuildDrain(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<Drain>(e), element, DrainKind.Unknown, SystemId(k, e),
            SpaceId(k, e),
            k.Number(e, "OutletDiameter", "m", x => new Length(x), false, "Outlet Diameter", "Sanitary Diameter"),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            k.Number(e, "CatchmentArea", "m2", x => new Area(x), false, "Catchment Area"),
            k.Number(e, "InvertElevation", "m", x => new Length(x), true, "Invert Elevation"),
            k.Flag(e, "IsTrapped", "Trapped", "Is Trapped"),
            MaterialReference(k, e, "GrateMaterialId", "Grate Material", "Roof Drain Material"),
            LinkSet<ServicePort>.Unknown());

    // ServiceSystem has no element identity or storey/space context; the discipline is only fixed when the source
    // text equals a ServiceDiscipline member name exactly once its spaces are removed, never inferred otherwise.
    private static ServiceSystem BuildServiceSystem(MappingKernel k, EntityRow e)
    {
        var classification = k.Text(e, "Classification", "System Classification");
        var discipline = classification is Fact<string>.Known known
            && Enum.TryParse<ServiceDiscipline>(known.Value.Replace(" ", ""), out var parsed) && parsed != ServiceDiscipline.Unknown
            ? parsed : ServiceDiscipline.Unknown;
        var name = string.IsNullOrWhiteSpace(e.Name) ? "System " + e.Id : e.Name;
        return new(k.Key<ServiceSystem>(e), name, discipline,
            MappingKernel.Unknown<string>(),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            MappingKernel.Unknown<Temperature>(),
            ReadPressure(k, e, "DesignPressure", "Static Pressure"),
            LinkSet<Space>.Unknown(), LinkSet<ServicePort>.Unknown(),
            k.IdentityEvidence(e.Id));
    }

    // Back-links a mapped pipe, fitting, valve, pump or drain to its resolved fluid system; membership carries the
    // element's own identity evidence and an unknown role, the way CoreMapping links spaces to doors. SanitaryFixture
    // has no SystemId field in the contract, so it cannot participate here; see the checkpoint.
    private static void Complete(MappingKernel k, ProjectionBuilder b)
    {
        void Link(IEnumerable<(ElementInfo Element, Fact<SnapshotKey<ServiceSystem>> SystemId)> rows)
        {
            foreach (var (element, systemId) in rows)
            {
                if (systemId is not Fact<SnapshotKey<ServiceSystem>>.Known known) continue;
                var id = new SnapshotKey<SystemMembership>(k.Snapshot, "membership/" + BuildingMapper.Digest(known.Value.Value + "/" + element.ObjectId.Value));
                b.Add(new SystemMembership(id, known.Value, element.ObjectId, MappingKernel.Unknown<string>(), element.Evidence.Single()));
            }
        }
        Link(b.Rows<PipeSegment>().Select(x => (x.Element, x.SystemId)));
        Link(b.Rows<PipeFitting>().Select(x => (x.Element, x.SystemId)));
        Link(b.Rows<Valve>().Select(x => (x.Element, x.SystemId)));
        Link(b.Rows<Pump>().Select(x => (x.Element, x.SystemId)));
        Link(b.Rows<Drain>().Select(x => (x.Element, x.SystemId)));
        Link(b.Rows<FireProtectionTerminal>().Select(x => (x.Element, x.SystemId)));
    }
}
