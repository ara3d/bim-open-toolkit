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
            b.Add(ServiceSystems.Build(k, e));
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

    private static Fact<FlowRate> ReadFlow(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => ServiceSystems.ReadFlow(k, e, field, aliases);

    private static Fact<Pressure> ReadPressure(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => ServiceSystems.ReadPressure(k, e, field, aliases);

    private static Fact<Temperature> ReadTemperature(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => ServiceSystems.ReadTemperature(k, e, field, aliases);

    // The system an occurrence belongs to is joined by exact name in Complete, once every system row exists.
    private static Fact<SnapshotKey<ServiceSystem>> UnresolvedSystem => MappingKernel.Unknown<SnapshotKey<ServiceSystem>>();

    private static Fact<SnapshotKey<Space>> SpaceId(MappingKernel k, EntityRow e)
        => k.Reference<Space>(e, "SpaceId", "Rvt:FamilyInstance:Room", "Rvt:FamilyInstance:Space");


    // Revit stores slope as a dimensionless rise/run ratio; a descriptor carrying its own explicit units, or a
    // canonical dimension, is a different quantity (rise per 12 inches, say) and is never reinterpreted as a ratio.
    // Empty units is also what every IFC descriptor carries, so a bare number is only trusted once the caller has
    // established what the source stores.
    private static Fact<Ratio> Slope(MappingKernel k, EntityRow e)
        => k.Resolve<Ratio>(e, "Slope", k.Select(e, ParameterType.Number, "Slope"), p =>
            !string.IsNullOrEmpty(p.Units) || p.CanonicalNumber is not null
                ? Fact<Ratio>.Unknown("Slope descriptor carries an explicit dimension; dimensionless rise/run is not established.")
                : k.Storage == NumericStoragePolicy.Unknown
                    ? Fact<Ratio>.Unknown("Stored numeric units are not established; a bare number is not taken as a dimensionless rise/run.")
                    : p.NumberValue is { } value && double.IsFinite(value)
                        ? new Fact<Ratio>.Known(new(value), Assurance.Observed, [])
                        : new Fact<Ratio>.Missing(Availability.Invalid, "Slope value is not a finite number.", []));

    private static PipeSegment BuildPipeSegment(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<PipeSegment>(e), element, UnresolvedSystem,
            k.Text(e, "NominalSize", "Size"),
            k.Number(e, "OutsideDiameter", "m", x => new Length(x), false, "Outside Diameter"),
            k.Number(e, "InsideDiameter", "m", x => new Length(x), false, "Inside Diameter"),
            k.Number(e, "CenterlineLength", "m", x => new Length(x), false, "Length"),
            k.Global<Material>(e, "MaterialId", "Material"),
            k.Number(e, "WallThickness", "m", x => new Length(x), false, "Wall Thickness"),
            k.Number(e, "InsulationThickness", "m", x => new Length(x), false, "Insulation Thickness"),
            Slope(k, e),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            ReadPressure(k, e, "PressureRating", "Pressure Rating"),
            LinkSet<ServicePort>.Unknown());

    private static PipeFitting BuildPipeFitting(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<PipeFitting>(e), element, UnresolvedSystem, FittingFunction.Unknown,
            k.Global<Material>(e, "MaterialId", "Material"),
            k.Number(e, "BendAngle", "rad", x => new Angle(x), true, "Angle"),
            k.Number(e, "CenterlineRadius", "m", x => new Length(x), false, "Center Radius"),
            ReadPressure(k, e, "PressureRating", "Pressure Rating"),
            LinkSet<ServicePort>.Unknown());

    private static Valve BuildValve(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<Valve>(e), element, UnresolvedSystem, ValveFunction.Unknown,
            k.Text(e, "NominalSize", "Size"),
            k.Global<Material>(e, "MaterialId", "Material"),
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
        => new(k.Key<FireProtectionTerminal>(e), element, FireProtectionTerminalKind.Unknown, UnresolvedSystem,
            SpaceId(k, e),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            ReadPressure(k, e, "RequiredPressure", "Required Pressure"),
            ReadTemperature(k, e, "ActivationTemperature", "Activation Temperature"),
            k.Number(e, "CoverageArea", "m2", x => new Area(x), false, "Coverage Area"),
            k.Text(e, "Orientation", "Orientation"),
            LinkSet<ServicePort>.Unknown());

    private static Pump BuildPump(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<Pump>(e), element, UnresolvedSystem,
            k.Text(e, "PumpType", "Pump Type"),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            ReadPressure(k, e, "PressureRise", "Pressure Rise"),
            k.Number(e, "ElectricalInput", "W", x => new Power(x), false, "Electrical Input"),
            k.Number(e, "Efficiency", "ratio", x => new Ratio(x), false, "Efficiency"),
            k.Flag(e, "VariableSpeed", "Variable Speed"),
            k.Text(e, "DutyRole", "Duty Role"),
            LinkSet<ServicePort>.Unknown());

    private static Drain BuildDrain(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<Drain>(e), element, DrainKind.Unknown, UnresolvedSystem,
            SpaceId(k, e),
            k.Number(e, "OutletDiameter", "m", x => new Length(x), false, "Outlet Diameter", "Sanitary Diameter"),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            k.Number(e, "CatchmentArea", "m2", x => new Area(x), false, "Catchment Area"),
            k.Number(e, "InvertElevation", "m", x => new Length(x), true, "Invert Elevation"),
            k.Flag(e, "IsTrapped", "Trapped", "Is Trapped"),
            k.Global<Material>(e, "GrateMaterialId", "Grate Material", "Roof Drain Material"),
            LinkSet<ServicePort>.Unknown());

    // Every mapped occurrence is joined to its fluid system by exact "System Name" text, once every system row exists:
    // the source's "System Type" parameter names the system type element, not this occurrence's system.
    // SanitaryFixture has no SystemId field in the contract, so it cannot participate; see the checkpoint.
    private static void Complete(MappingKernel k, ProjectionBuilder b)
    {
        var systems = ServiceSystems.Index(k, "Piping Systems");
        var ids = ServiceSystems.SystemIds(k, systems, "PipeSegment", "PipeFitting", "Valve", "Pump", "Drain", "FireProtectionTerminal");
        Fact<SnapshotKey<ServiceSystem>> Id(ElementInfo element) => ids.GetValueOrDefault(element.ObjectId, UnresolvedSystem);
        b.Update<PipeSegment>(r => r with { SystemId = Id(r.Element) });
        b.Update<PipeFitting>(r => r with { SystemId = Id(r.Element) });
        b.Update<Valve>(r => r with { SystemId = Id(r.Element) });
        b.Update<Pump>(r => r with { SystemId = Id(r.Element) });
        b.Update<Drain>(r => r with { SystemId = Id(r.Element) });
        b.Update<FireProtectionTerminal>(r => r with { SystemId = Id(r.Element) });
        ServiceSystems.Memberships(k, b, b.Rows<PipeSegment>().Select(r => (r.Element, r.SystemId)));
        ServiceSystems.Memberships(k, b, b.Rows<PipeFitting>().Select(r => (r.Element, r.SystemId)));
        ServiceSystems.Memberships(k, b, b.Rows<Valve>().Select(r => (r.Element, r.SystemId)));
        ServiceSystems.Memberships(k, b, b.Rows<Pump>().Select(r => (r.Element, r.SystemId)));
        ServiceSystems.Memberships(k, b, b.Rows<Drain>().Select(r => (r.Element, r.SystemId)));
        ServiceSystems.Memberships(k, b, b.Rows<FireProtectionTerminal>().Select(r => (r.Element, r.SystemId)));
    }
}
