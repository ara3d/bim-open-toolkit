using System.Collections.Immutable;
using System.Globalization;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Panels, circuits, lighting, devices, cables and containment. Wave R5 track G; see WAVE-R5.md.
/// Voltage, current and power are not convertible under either numeric storage policy (Revit stores them in
/// non-length units the kernel does not carry a documented factor for), so those facts stay unavailable rather
/// than guessing a conversion.</summary>
public static class ElectricalMapping
{
    public static readonly DomainMapping Domain = new("Electrical",
    [
        new("Electrical Circuits", "ElectricalCircuit"), new("IFCELECTRICALCIRCUIT", "ElectricalCircuit"),
        new("Lighting Fixtures", "LightingFixture"), new("IFCLIGHTFIXTURE", "LightingFixture"),
        new("Electrical Fixtures", "ElectricalDevice"), new("Lighting Devices", "ElectricalDevice"),
        new("Data Devices", "ElectricalDevice"), new("Communication Devices", "ElectricalDevice"),
        new("Fire Alarm Devices", "ElectricalDevice"), new("Security Devices", "ElectricalDevice"),
        new("Nurse Call Devices", "ElectricalDevice"), new("Telephone Devices", "ElectricalDevice"),
        new("IFCOUTLET", "ElectricalDevice"), new("IFCSWITCHINGDEVICE", "ElectricalDevice"),
        new("IFCSENSOR", "ElectricalDevice"), new("IFCALARM", "ElectricalDevice"),
        new("Wires", "CableSegment"), new("IFCCABLESEGMENT", "CableSegment"),
        new("Conduits", "CableContainment"), new("Cable Trays", "CableContainment"), new("IFCCABLECARRIERSEGMENT", "CableContainment"),
        new("IFCELECTRICDISTRIBUTIONBOARD", "ElectricalPanel"),
    ],
    ["Electrical - Loads", "Electrical - Circuiting", "Electrical - Lighting", "Electrical Engineering", "Electrical"],
    Map, Complete);

    private static void Map(MappingKernel k, EntityRow e, string kind, ProjectionBuilder b)
    {
        switch (kind)
        {
            case "ElectricalCircuit": MapCircuit(k, e, b); break;
            case "LightingFixture": MapLightingFixture(k, e, b); break;
            case "ElectricalDevice": MapDevice(k, e, b); break;
            case "CableSegment": MapCableSegment(k, e, b); break;
            case "CableContainment": MapCableContainment(k, e, b); break;
            case "ElectricalPanel": MapPanel(k, e, b); break;
        }
    }

    // Electrical Circuits/IFCELECTRICALCIRCUIT are logical rows, not element occurrences: no Element() call.
    private static void MapCircuit(MappingKernel k, EntityRow e, ProjectionBuilder b)
    {
        var number = k.Text(e, "Designation", "Circuit Number");
        var designation = number is Fact<string>.Known known ? known.Value
            : !string.IsNullOrWhiteSpace(e.Name) ? e.Name
            : "Circuit " + e.Id.ToString(CultureInfo.InvariantCulture);
        b.Add(new ElectricalCircuit(k.Key<ElectricalCircuit>(e), MappingKernel.Unknown<SnapshotKey<ElectricalPanel>>(),
            designation, k.Text(e, "Purpose", "Load Name"),
            k.Number(e, "Voltage", "V", x => new Voltage(x), false, "Voltage"),
            k.Integer(e, "PoleCount", "Number of Poles"),
            k.Number(e, "ProtectionRating", "A", x => new ElectricCurrent(x), false, "Rating"),
            k.Number(e, "ConnectedLoad", "W", x => new Power(x), false, "Apparent Load", "Apparent Power"),
            MappingKernel.Unknown<Power>(), MappingKernel.Unknown<Ratio>(), MappingKernel.Unknown<bool>(), MappingKernel.Unknown<bool>(),
            MappingKernel.Unknown<SnapshotKey<ServiceSystem>>(), LinkSet<ServicePort>.Unknown(), k.IdentityEvidence(e.Id)));
    }

    private static void MapLightingFixture(MappingKernel k, EntityRow e, ProjectionBuilder b)
    {
        var element = k.Element(e);
        b.Add(new LightingFixture(k.Key<LightingFixture>(e), element, SingleSpace(k, e, element),
            k.Reference<ElectricalCircuit>(e, "CircuitId", "Circuit Number", "Circuit"),
            MappingKernel.Unknown<string>(), k.Number(e, "InputPower", "W", x => new Power(x), false, "Apparent Load", "Apparent Power"),
            MappingKernel.Unknown<double>(), MappingKernel.Unknown<double>(), MappingKernel.Unknown<double>(),
            MappingKernel.Unknown<string>(), MappingKernel.Unknown<bool>(), MappingKernel.Unknown<DurationValue>(),
            MappingKernel.Unknown<string>(), LinkSet<ServicePort>.Unknown()));
    }

    private static void MapDevice(MappingKernel k, EntityRow e, ProjectionBuilder b)
    {
        var element = k.Element(e);
        b.Add(new ElectricalDevice(k.Key<ElectricalDevice>(e), element, DeviceKind(e), SingleSpace(k, e, element),
            k.Reference<ElectricalCircuit>(e, "CircuitId", "Circuit Number", "Circuit"),
            MappingKernel.Unknown<Voltage>(), MappingKernel.Unknown<ElectricCurrent>(),
            k.Number(e, "InputPower", "W", x => new Power(x), false, "Apparent Load", "Apparent Power"),
            MappingKernel.Unknown<Length>(), MappingKernel.Unknown<string>(), MappingKernel.Unknown<int>(),
            MappingKernel.Unknown<string>(), LinkSet<ServicePort>.Unknown()));
    }

    // Category fixes the device family; nothing is derived from the element's name.
    private static ElectricalDeviceKind DeviceKind(EntityRow e) => TextNormalization.Key(e.Category) switch
    {
        "DATA DEVICES" => ElectricalDeviceKind.DataOutlet,
        "IFCOUTLET" => ElectricalDeviceKind.SocketOutlet,
        "IFCSWITCHINGDEVICE" => ElectricalDeviceKind.Switch,
        "IFCSENSOR" => ElectricalDeviceKind.Sensor,
        "IFCALARM" => ElectricalDeviceKind.Alarm,
        _ => ElectricalDeviceKind.Unknown
    };

    // Neither Snowdon Wires nor the source inventory carry an approved, reviewed field for cable construction,
    // conductor count/area, length or rated voltage; every fact stays unavailable rather than guessing an alias.
    private static void MapCableSegment(MappingKernel k, EntityRow e, ProjectionBuilder b)
        => b.Add(new CableSegment(k.Key<CableSegment>(e), k.Element(e), MappingKernel.Unknown<SnapshotKey<ElectricalCircuit>>(),
            MappingKernel.Unknown<string>(), MappingKernel.Unknown<int>(), MappingKernel.Unknown<Area>(),
            MappingKernel.Unknown<ReferenceKey<Material>>(), MappingKernel.Unknown<Length>(), MappingKernel.Unknown<Length>(),
            MappingKernel.Unknown<Length>(), MappingKernel.Unknown<Voltage>(), MappingKernel.Unknown<string>(),
            LinkSet<CableContainment>.Unknown(), LinkSet<ServicePort>.Unknown()));

    private static void MapCableContainment(MappingKernel k, EntityRow e, ProjectionBuilder b)
    {
        var kind = ContainmentKind(e);
        // A circular conduit has no rectangular clear width/height; that is a consequence of the fixed Kind, not a name guess.
        var (clearWidth, clearHeight) = kind == CableContainmentKind.Conduit
            ? (Fact<Length>.Inapplicable("Circular conduit; clear width/height apply to rectangular containment."),
               Fact<Length>.Inapplicable("Circular conduit; clear width/height apply to rectangular containment."))
            : (MappingKernel.Unknown<Length>(), MappingKernel.Unknown<Length>());
        k.Count(e, "ClearWidth", clearWidth);
        k.Count(e, "ClearHeight", clearHeight);
        b.Add(new CableContainment(k.Key<CableContainment>(e), k.Element(e), kind,
            MappingKernel.Unknown<ReferenceKey<Material>>(), clearWidth, clearHeight,
            k.Number(e, "ClearDiameter", "m", x => new Length(x), false, "Inside Diameter"),
            k.Number(e, "CenterlineLength", "m", x => new Length(x), false, "Length"),
            MappingKernel.Unknown<bool>(), MappingKernel.Unknown<Ratio>(), MappingKernel.Unknown<Ratio>(),
            LinkSet<ServiceSupport>.Unknown(), LinkSet<ServicePort>.Unknown()));
    }

    private static CableContainmentKind ContainmentKind(EntityRow e) => TextNormalization.Key(e.Category) switch
    {
        "CONDUITS" => CableContainmentKind.Conduit,
        "CABLE TRAYS" => CableContainmentKind.CableTray,
        _ => CableContainmentKind.Unknown
    };

    // IFCELECTRICDISTRIBUTIONBOARD only; Snowdon's Electrical Equipment is deliberately left unmapped (see checkpoint),
    // so no source inventory has been reviewed for panel field aliases. Circuits is filled in Complete.
    private static void MapPanel(MappingKernel k, EntityRow e, ProjectionBuilder b)
    {
        var element = k.Element(e);
        b.Add(new ElectricalPanel(k.Key<ElectricalPanel>(e), element, SingleSpace(k, e, element),
            MappingKernel.Unknown<string>(), MappingKernel.Unknown<Voltage>(), MappingKernel.Unknown<int>(),
            MappingKernel.Unknown<ElectricCurrent>(), MappingKernel.Unknown<ElectricCurrent>(), MappingKernel.Unknown<ElectricCurrent>(),
            MappingKernel.Unknown<int>(), MappingKernel.Unknown<string>(),
            LinkSet<ElectricalCircuit>.Unknown(), LinkSet<ServicePort>.Unknown(), MappingKernel.Unknown<Length>()));
    }

    // A single observed room/space is kept; zero or several stay Unknown rather than picking one.
    private static Fact<SnapshotKey<Space>> SingleSpace(MappingKernel k, EntityRow e, ElementInfo element)
    {
        var spaces = element.Location.Spaces;
        Fact<SnapshotKey<Space>> fact;
        if (spaces.Items.Length == 1) fact = new Fact<SnapshotKey<Space>>.Known(spaces.Items[0], Assurance.Observed, spaces.Evidence);
        else
        {
            k.Diagnose("field.ambiguous-space", e, "SpaceId", spaces.Items.Length == 0
                ? "No room/space association observed."
                : "Multiple room/space associations observed; single-space assignment is not resolved.");
            fact = MappingKernel.Unknown<SnapshotKey<Space>>();
        }
        k.Count(e, "SpaceId", fact);
        return fact;
    }

    // Circuits' PanelId is Unknown throughout Snowdon (Electrical Equipment is unmapped), so this never populates
    // today; it stays correct for a source where panels and circuits are both mapped.
    private static void Complete(MappingKernel k, ProjectionBuilder b)
    {
        var circuitsByPanel = b.Rows<ElectricalCircuit>().Where(c => c.PanelId is Fact<SnapshotKey<ElectricalPanel>>.Known)
            .GroupBy(c => ((Fact<SnapshotKey<ElectricalPanel>>.Known)c.PanelId).Value)
            .ToDictionary(g => g.Key, g => g.Select(c => c.Id).ToImmutableArray());
        b.Update<ElectricalPanel>(p => p with { Circuits = new(circuitsByPanel.GetValueOrDefault(p.Id, []), Completeness.Partial, []) });
    }
}
