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
            b.Add(ServiceSystems.Build(k, e));
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

    private static Fact<FlowRate> ReadFlow(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => ServiceSystems.ReadFlow(k, e, field, aliases);

    private static Fact<Pressure> ReadPressure(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => ServiceSystems.ReadPressure(k, e, field, aliases);

    private static Fact<Power> ReadPower(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => ServiceSystems.ReadPower(k, e, field, aliases);

    private static Fact<SoundLevel> ReadSound(MappingKernel k, EntityRow e, string field, params string[] aliases)
        => ServiceSystems.ReadSound(k, e, field, aliases);

    // The system an occurrence belongs to is joined by exact name in Complete, once every system row exists.
    private static Fact<SnapshotKey<ServiceSystem>> UnresolvedSystem => MappingKernel.Unknown<SnapshotKey<ServiceSystem>>();

    private static DuctSegment BuildDuctSegment(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<DuctSegment>(e), element, UnresolvedSystem, MappingKernel.Unknown<FlowSectionShape>(),
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
        => new(k.Key<DuctFitting>(e), element, UnresolvedSystem, FittingFunction.Unknown,
            MappingKernel.Unknown<ReferenceKey<Material>>(),
            k.Number(e, "BendAngle", "rad", x => new Angle(x), false, "Angle"),
            k.Number(e, "CenterlineRadius", "m", x => new Length(x), false, "Radius"),
            k.Flag(e, "HasTurningVanes", "Turning Vanes", "Has Turning Vanes"),
            k.Number(e, "InsulationThickness", "m", x => new Length(x), false, "Insulation Thickness"),
            LinkSet<ServicePort>.Unknown());

    private static AirTerminal BuildAirTerminal(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<AirTerminal>(e), element, UnresolvedSystem,
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
        => new(k.Key<Damper>(e), element, UnresolvedSystem, DamperFunction.Unknown,
            k.Text(e, "Actuation", "Actuation"),
            k.Text(e, "FailPosition", "Fail Position"),
            k.FireResistance(e),
            k.Text(e, "SmokeLeakageClass", "Smoke Leakage Class"),
            k.Flag(e, "AccessRequired", "Access Required"),
            LinkSet<ServicePort>.Unknown());

    private static Fan BuildFan(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<Fan>(e), element, UnresolvedSystem,
            k.Text(e, "FanType", "Fan Type"),
            ReadFlow(k, e, "DesignFlow", "Flow"),
            ReadPressure(k, e, "PressureRise", "Pressure Rise"),
            ReadPower(k, e, "ElectricalInput", "Electrical Input"),
            k.Number(e, "Efficiency", "ratio", x => new Ratio(x), false, "Efficiency"),
            k.Flag(e, "VariableSpeed", "Variable Speed"),
            ReadSound(k, e, "SoundPowerLevel", "Sound Power Level"),
            LinkSet<ServicePort>.Unknown());

    private static AirHandlingUnit BuildAirHandlingUnit(MappingKernel k, EntityRow e, ElementInfo element)
        => new(k.Key<AirHandlingUnit>(e), element, LinkSet<ServiceSystem>.Unknown(),
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

    // Every mapped occurrence is joined to its air system by exact "System Name" text, once every system row exists:
    // the source's "System Type" parameter names the system type element, not this occurrence's system.
    private static void Complete(MappingKernel k, ProjectionBuilder b)
    {
        var systems = ServiceSystems.Index(k, "Duct Systems", "IFCDISTRIBUTIONSYSTEM");
        var ids = ServiceSystems.SystemIds(k, systems, "DuctSegment", "DuctFitting", "AirTerminal", "Damper", "Fan", "AirHandlingUnit");
        Fact<SnapshotKey<ServiceSystem>> Id(ElementInfo element) => ids.GetValueOrDefault(element.ObjectId, UnresolvedSystem);
        b.Update<DuctSegment>(r => r with { SystemId = Id(r.Element) });
        b.Update<DuctFitting>(r => r with { SystemId = Id(r.Element) });
        b.Update<AirTerminal>(r => r with { SystemId = Id(r.Element) });
        b.Update<Damper>(r => r with { SystemId = Id(r.Element) });
        b.Update<Fan>(r => r with { SystemId = Id(r.Element) });
        b.Update<AirHandlingUnit>(r => r with { Systems = ServiceSystems.Links(Id(r.Element)) });
        ServiceSystems.Memberships(k, b, b.Rows<DuctSegment>().Select(r => (r.Element, r.SystemId)));
        ServiceSystems.Memberships(k, b, b.Rows<DuctFitting>().Select(r => (r.Element, r.SystemId)));
        ServiceSystems.Memberships(k, b, b.Rows<AirTerminal>().Select(r => (r.Element, r.SystemId)));
        ServiceSystems.Memberships(k, b, b.Rows<Damper>().Select(r => (r.Element, r.SystemId)));
        ServiceSystems.Memberships(k, b, b.Rows<Fan>().Select(r => (r.Element, r.SystemId)));
    }
}
