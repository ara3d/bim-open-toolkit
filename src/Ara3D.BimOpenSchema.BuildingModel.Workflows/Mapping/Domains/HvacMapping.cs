using System.Collections.Immutable;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Ducts, fittings, air terminals, dampers, air handling units, fans and HVAC systems. Wave R5 track E; see WAVE-R5.md.</summary>
public static class HvacMapping
{
    public static readonly DomainMapping Domain = new("Hvac",
    [
        new("Ducts", "DuctSegment"), new("Flex Ducts", "DuctSegment"), new("IFCDUCTSEGMENT", "DuctSegment"),
        new("Duct Fittings", "DuctFitting"), new("IFCDUCTFITTING", "DuctFitting"),
        new("Air Terminals", "AirTerminal"), new("IFCAIRTERMINAL", "AirTerminal"),
        new("IFCDAMPER", "Damper"),
        new("IFCFAN", "Fan"),
        new("IFCUNITARYEQUIPMENT", "AirHandlingUnit"),
        new("Duct Systems", "ServiceSystem"), new("IFCDISTRIBUTIONSYSTEM", "ServiceSystem")
    ],
    ["Mechanical", "Mechanical - Flow", "Insulation", "Lining"],
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
            case "DuctSegment": b.Add(BuildDuctSegment(k, e, element)); break;
            case "DuctFitting": b.Add(BuildDuctFitting(k, e, element)); break;
            case "AirTerminal": b.Add(BuildAirTerminal(k, e, element)); break;
            case "Damper": b.Add(BuildDamper(k, e, element)); break;
            case "Fan": b.Add(BuildFan(k, e, element)); break;
            case "AirHandlingUnit": b.Add(BuildAirHandlingUnit(k, e, element)); break;
        }
    }

    // Air system, flow, pressure, power and sound level are not convertible from a Revit-internal number by this kernel;
    // the unit keys below are unfamiliar to it on purpose, so the fact stays unavailable rather than guessed.
    private static Fact<FlowRate> ReadFlow(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Number(e, field, "m3/s", x => new FlowRate(x), false, aliases);

    private static Fact<Pressure> ReadPressure(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Number(e, field, "Pa", x => new Pressure(x), false, aliases);

    private static Fact<Power> ReadPower(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Number(e, field, "W", x => new Power(x), false, aliases);

    private static Fact<SoundLevel> ReadSound(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => k.Number(e, field, "dB", x => new SoundLevel(x), false, aliases);

    private static Fact<SnapshotKey<ServiceSystem>> SystemId(MappingKernel k, EntityRow e)
        => k.Reference<ServiceSystem>(e, "SystemId", "System Type");

    private static DuctSegment BuildDuctSegment(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<DuctSegment>(e), element, SystemId(k, e), MappingKernel.Unknown<FlowSectionShape>(),
            k.Number(e, "Width", "m", x => new Length(x), false, "Width"),
            k.Number(e, "Height", "m", x => new Length(x), false, "Height"),
            k.Number(e, "Diameter", "m", x => new Length(x), false, "Diameter"),
            k.Number(e, "CenterlineLength", "m", x => new Length(x), false, "Length"),
            MappingKernel.Unknown<ReferenceKey<Material>>(),
            k.Number(e, "InsulationThickness", "m", x => new Length(x), false, "Insulation Thickness"),
            k.Number(e, "LiningThickness", "m", x => new Length(x), false, "Lining Thickness"),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            k.Text(e, "PressureClass", "Pressure Class"),
            LinkSet<ServicePort>.Unknown());

    private static DuctFitting BuildDuctFitting(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<DuctFitting>(e), element, SystemId(k, e), FittingFunction.Unknown,
            MappingKernel.Unknown<ReferenceKey<Material>>(),
            k.Number(e, "BendAngle", "rad", x => new Angle(x), false, "Angle"),
            k.Number(e, "CenterlineRadius", "m", x => new Length(x), false, "Radius"),
            k.Flag(e, "HasTurningVanes", "Turning Vanes", "Has Turning Vanes"),
            k.Number(e, "InsulationThickness", "m", x => new Length(x), false, "Insulation Thickness"),
            LinkSet<ServicePort>.Unknown());

    private static AirTerminal BuildAirTerminal(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<AirTerminal>(e), element, SystemId(k, e),
            k.Reference<Space>(e, "SpaceId", "Rvt:FamilyInstance:Space"),
            k.Text(e, "TerminalStyle", "Terminal Style"),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            k.Number(e, "FaceWidth", "m", x => new Length(x), false, "Width"),
            k.Number(e, "FaceHeight", "m", x => new Length(x), false, "Height"),
            k.Number(e, "NeckDiameter", "m", x => new Length(x), false, "Neck Diameter"),
            ReadSound(k, e, "SoundPowerLevel", "Sound Power Level"),
            k.Text(e, "Finish", "Finish"),
            LinkSet<ServicePort>.Unknown());

    private static Damper BuildDamper(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<Damper>(e), element, SystemId(k, e), DamperFunction.Unknown,
            k.Text(e, "Actuation", "Actuation"),
            k.Text(e, "FailPosition", "Fail Position"),
            k.FireResistance(e),
            k.Text(e, "SmokeLeakageClass", "Smoke Leakage Class"),
            k.Flag(e, "AccessRequired", "Access Required"),
            LinkSet<ServicePort>.Unknown());

    private static Fan BuildFan(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<Fan>(e), element, SystemId(k, e),
            k.Text(e, "FanType", "Fan Type"),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            ReadPressure(k, e, "PressureRise", "Pressure Rise"),
            ReadPower(k, e, "ElectricalInput", "Electrical Input"),
            k.Number(e, "Efficiency", "ratio", x => new Ratio(x), false, "Efficiency"),
            k.Flag(e, "VariableSpeed", "Variable Speed"),
            ReadSound(k, e, "SoundPowerLevel", "Sound Power Level"),
            LinkSet<ServicePort>.Unknown());

    private static AirHandlingUnit BuildAirHandlingUnit(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<AirHandlingUnit>(e), element, k.Links<ServiceSystem>(e, "Systems", "System Type"),
            ReadFlow(k, e, "SupplyFlow", "Supply Air Flow"),
            ReadFlow(k, e, "OutsideAirFlow", "Outside Air Flow"),
            ReadPower(k, e, "HeatingCapacity", "Heating Capacity"),
            ReadPower(k, e, "CoolingCapacity", "Cooling Capacity"),
            ReadPower(k, e, "ElectricalInput", "Electrical Input"),
            ReadPressure(k, e, "ExternalStaticPressure", "External Static Pressure"),
            k.Text(e, "FilterClass", "Filter Class"),
            k.Number(e, "HeatRecoveryEfficiency", "ratio", x => new Ratio(x), false, "Heat Recovery Efficiency"),
            k.Number(e, "DryMass", "kg", x => new Mass(x), false, "Dry Mass"),
            k.Number(e, "MaintenanceClearance", "m", x => new Length(x), false, "Maintenance Clearance"),
            LinkSet<ServicePort>.Unknown());

    // ServiceSystem has no element identity or storey/space context; the discipline is only fixed when the source text
    // equals a ServiceDiscipline member name exactly once its spaces are removed, never inferred otherwise.
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

    // Back-links a mapped duct, fitting or terminal to its resolved air system; membership carries the segment's own
    // identity evidence and an unknown role, the way CoreMapping links spaces to doors.
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
        Link(b.Rows<DuctSegment>().Select(d => (d.Element, d.SystemId)));
        Link(b.Rows<DuctFitting>().Select(d => (d.Element, d.SystemId)));
        Link(b.Rows<AirTerminal>().Select(d => (d.Element, d.SystemId)));
    }
}
