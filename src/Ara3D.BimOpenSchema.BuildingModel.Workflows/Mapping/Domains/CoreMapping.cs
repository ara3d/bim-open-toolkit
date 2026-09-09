using System.Collections.Immutable;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Storeys, spaces, doors and roofs: the original architectural scope, now one domain among several.</summary>
public static class CoreMapping
{
    public static readonly DomainMapping Domain = new("Core",
    [
        new("Levels", "Storey"), new("Level", "Storey"), new("Storeys", "Storey"), new("IfcBuildingStorey", "Storey"), new("Ebenen", "Storey"),
        new("Rooms", "Space"), new("Room", "Space"), new("Spaces", "Space"), new("IfcSpace", "Space"), new("Räume", "Space"),
        new("Doors", "Door"), new("Door", "Door"), new("IfcDoor", "Door"), new("Türen", "Door"),
        new("Roofs", "Roof"), new("Roof", "Roof"), new("IfcRoof", "Roof"), new("Dächer", "Roof")
    ],
    ["Rooms", "Room", "Pset_DoorCommon", "Pset_SpaceCommon", "Qto_RoofBaseQuantities", "Qto_SpaceBaseQuantities", "Qto_DoorBaseQuantities", "IfcBuildingStorey"],
    Map, Complete);

    private static void Map(MappingKernel k, EntityRow e, string kind, ProjectionBuilder b)
    {
        var element = k.Element(e);
        switch (kind)
        {
            case "Storey":
                b.Add(new Storey(k.Key<Storey>(e), element, MappingKernel.Unknown<SnapshotKey<Building>>(),
                    k.Text(e, "Number", "Number", "Level Number"), MappingKernel.Unknown<int>(),
                    k.Number(e, "Elevation", "m", x => new Length(x), true, "Elevation", "Rvt:Level:Elevation", "Ifc:Elevation"),
                    MappingKernel.Unknown<SnapshotKey<CoordinateFrame>>(), MappingKernel.Unknown<StoreyDatumKind>(), MappingKernel.Unknown<Length>(), LinkSet<Space>.Unknown()));
                break;
            case "Space":
                b.Add(new Space(k.Key<Space>(e), element, k.Text(e, "Number", "Number", "Room Number", "Nummer", "Rvt:Room:Number", "Ifc:Room:Number"),
                    MappingKernel.Unknown<SnapshotKey<Building>>(), element.Location.PrimaryStorey,
                    k.Text(e, "Use", "Occupancy", "Use"), k.Text(e, "Department", "Department", "Abteilung"),
                    MappingKernel.Unknown<SpaceEnclosureKind>(), k.Number(e, "NetFloorArea", "m2", x => new Area(x), false, "Net Floor Area", "NetFloorArea"),
                    k.Text(e, "AreaMeasurementStandard", "Area Measurement Standard"),
                    k.Number(e, "ClearHeight", "m", x => new Length(x), false, "Clear Height"),
                    k.Number(e, "NetVolume", "m3", x => new Volume(x), false, "Net Volume", "NetVolume"),
                    MappingKernel.Unknown<int>(), MappingKernel.Unknown<SnapshotKey<GeometryRepresentation>>(), LinkSet<SpaceBoundary>.Unknown(),
                    LinkSet<FinishSurface>.Unknown(), LinkSet<Door>.Unknown()));
                break;
            case "Door":
                b.Add(new Door(k.Key<Door>(e), element, k.Product(e), MappingKernel.Unknown<SnapshotKey<Opening>>(),
                    element.Location.Spaces, MappingKernel.Unknown<DoorOperation>(), MappingKernel.Unknown<int>(),
                    k.Number(e, "NominalWidth", "m", x => new Length(x), false, "Width", "Nominal Width", "Breite"),
                    k.Number(e, "NominalHeight", "m", x => new Length(x), false, "Height", "Nominal Height", "Höhe"),
                    k.Number(e, "ClearWidth", "m", x => new Length(x), false, "Clear Width", "Clear Opening Width"),
                    k.Number(e, "ClearHeight", "m", x => new Length(x), false, "Clear Height", "Clear Opening Height"),
                    k.FireResistance(e),
                    MappingKernel.Unknown<bool>(), k.Text(e, "HardwareSet", "Hardware Set", "Hardware Set Number"), MappingKernel.Unknown<bool>()));
                break;
            case "Roof":
                b.Add(new Roof(k.Key<Roof>(e), element, k.Assembly(e), element.Location.PrimaryStorey,
                    k.Number(e, "NetSurfaceArea", "m2", x => new Area(x), false, "Net Surface Area", "NetSurfaceArea"),
                    k.Number(e, "ProjectedArea", "m2", x => new Area(x), false, "Projected Area", "ProjectedArea"),
                    MappingKernel.Unknown<Angle>(), MappingKernel.Unknown<Length>(), MappingKernel.Unknown<ThermalTransmittance>(),
                    MappingKernel.Unknown<SnapshotKey<QuantityObservation>>(), LinkSet<Opening>.Unknown(), LinkSet<FinishSurface>.Unknown()));
                break;
        }
        if (kind is "Space" or "Roof")
        {
            k.Count(e, "FinishSurfaces", MappingKernel.Unknown<string>());
            if (k.Rows(e).Any(p => TextNormalization.Key(p.Name) is "AREA" or "FLÄCHE"))
                k.Diagnose("quantity.unspecified-basis", e, "Area", "Generic Area is retained in the source cache; its net/surface/deduction basis is not established by its name.");
        }
    }

    // Back-links from storeys to spaces and spaces to doors need every row of both tables.
    private static void Complete(MappingKernel k, ProjectionBuilder b)
    {
        var spacesByStorey = b.Rows<Space>().Where(s => s.Storey is Fact<SnapshotKey<Storey>>.Known)
            .GroupBy(s => ((Fact<SnapshotKey<Storey>>.Known)s.Storey).Value).ToDictionary(g => g.Key, g => g.Select(s => s.Id).ToImmutableArray());
        b.Update<Storey>(s => s with { Spaces = new(spacesByStorey.GetValueOrDefault(s.Id, []), Completeness.Partial, []) });
        var doorsBySpace = b.Rows<Door>().SelectMany(d => d.AdjacentSpaces.Items.Select(s => (Space: s, Door: d.Id)))
            .GroupBy(x => x.Space).ToDictionary(g => g.Key, g => g.Select(x => x.Door).Distinct().ToImmutableArray());
        b.Update<Space>(s => s with { Doors = new(doorsBySpace.GetValueOrDefault(s.Id, []), Completeness.Partial, []) });
    }
}
