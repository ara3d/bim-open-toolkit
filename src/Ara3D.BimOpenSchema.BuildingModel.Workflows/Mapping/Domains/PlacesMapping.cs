using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Projects, sites, buildings, zones, terrain and landscape. Wave R5 track D; see WAVE-R5.md.</summary>
public static class PlacesMapping
{
    public static readonly DomainMapping Domain = new("Places",
    [
        new("Project Information", "Project"), new("IFCPROJECT", "Project"),
        new("IFCSITE", "Site"),
        new("IFCBUILDING", "Building"),
        new("HVAC Zones", "Zone"), new("Areas", "Zone"), new("IFCZONE", "Zone"),
        new("Toposolid", "TerrainSurface"), new("Topography", "TerrainSurface"), new("Toposurface", "TerrainSurface"),
        new("Hardscape", "PavedArea"), new("Roads", "PavedArea"),
        new("Planting", "LandscapeAsset")
    ],
    // "Andere" is the German localization of the "Other" group carrying project metadata (Projektnummer, Projektstatus, Auftraggeber) on some IFC exports.
    ["Andere"],
    Map);

    private static void Map(MappingKernel k, EntityRow e, string kind, ProjectionBuilder b)
    {
        var element = k.Element(e);
        switch (kind)
        {
            // A source document is never a building; each Project Information/IFCPROJECT occurrence is its own project row.
            case "Project":
                b.Add(new Project(k.Key<Project>(e), element,
                    k.Text(e, "ProjectNumber", "Project Number", "Projektnummer"),
                    MappingKernel.Unknown<string>(),
                    k.Text(e, "OwnerName", "Client Name", "Bauherr", "Auftraggeber"),
                    k.Text(e, "Phase", "Project Status", "Projektstatus", "Projekt Status"),
                    MappingKernel.Unknown<SnapshotKey<CoordinateFrame>>(),
                    LinkSet<Site>.Unknown(), LinkSet<Building>.Unknown()));
                break;
            case "Site":
                b.Add(new Site(k.Key<Site>(e), element,
                    MappingKernel.Unknown<SnapshotKey<Project>>(),
                    k.Text(e, "Address", "Project Address", "Projektadresse"),
                    k.Text(e, "ParcelIdentifier", "Grundstücksnummer", "Parcel Number", "Parcel Identifier"),
                    k.Number(e, "LandArea", "m2", x => new Area(x), false, "Area"),
                    MappingKernel.Unknown<SnapshotKey<CoordinateFrame>>(),
                    LinkSet<Building>.Unknown(), LinkSet<TerrainSurface>.Unknown()));
                break;
            case "Building":
                b.Add(new Building(k.Key<Building>(e), element,
                    MappingKernel.Unknown<SnapshotKey<Project>>(), MappingKernel.Unknown<SnapshotKey<Site>>(),
                    k.Text(e, "BuildingNumber", "Building Name"),
                    MappingKernel.Unknown<string>(), MappingKernel.Unknown<Area>(), MappingKernel.Unknown<string>(), MappingKernel.Unknown<int>(),
                    LinkSet<Storey>.Unknown(), LinkSet<Space>.Unknown()));
                break;
            case "Zone":
            {
                // Purpose is fixed by the claiming category, never derived from an occurrence's own values.
                var purpose = TextNormalization.Key(e.Category) switch
                {
                    "HVAC ZONES" => "HVAC zone",
                    "AREAS" => "Area scheme area",
                    "IFCZONE" => "IFC zone",
                    _ => (string?)null
                };
                var purposeFact = purpose is { } p ? new Fact<string>.Known(p, Assurance.Derived, [k.IdentityEvidence(e.Id)]) : MappingKernel.Unknown<string>();
                k.Count(e, "Purpose", purposeFact);
                b.Add(new Zone(k.Key<Zone>(e), element, purposeFact, MappingKernel.Unknown<SnapshotKey<Building>>(),
                    k.Text(e, "Description", "Area Type"), LinkSet<ZoneMembership>.Unknown()));
                break;
            }
            case "TerrainSurface":
                b.Add(new TerrainSurface(k.Key<TerrainSurface>(e), element,
                    MappingKernel.Unknown<SnapshotKey<Site>>(), MappingKernel.Unknown<string>(), MappingKernel.Unknown<string>(),
                    MappingKernel.Unknown<SnapshotKey<GeometryRepresentation>>(),
                    MappingKernel.Unknown<Area>(),
                    k.Number(e, "SurfaceArea", "m2", x => new Area(x), false, "Area"),
                    MappingKernel.Unknown<Length>(),
                    k.Number(e, "MinimumElevation", "m", x => new Length(x), true, "Elevation at Bottom"),
                    k.Number(e, "MaximumElevation", "m", x => new Length(x), true, "Elevation at Top"),
                    MappingKernel.Unknown<SnapshotKey<CoordinateFrame>>()));
                break;
            case "PavedArea":
                b.Add(new PavedArea(k.Key<PavedArea>(e), element,
                    MappingKernel.Unknown<SnapshotKey<Site>>(), MappingKernel.Unknown<string>(), k.Assembly(e),
                    k.Number(e, "NetSurfaceArea", "m2", x => new Area(x), false, "Area"),
                    MappingKernel.Unknown<Area>(), MappingKernel.Unknown<Length>(), MappingKernel.Unknown<bool>(), MappingKernel.Unknown<Angle>(),
                    LinkSet<DrainageCatchment>.Unknown()));
                break;
            case "LandscapeAsset":
                b.Add(new LandscapeAsset(k.Key<LandscapeAsset>(e), element,
                    MappingKernel.Unknown<SnapshotKey<Site>>(), MappingKernel.Unknown<SnapshotKey<PlantingArea>>(),
                    MappingKernel.Unknown<string>(), k.Product(e), MappingKernel.Unknown<string>(), MappingKernel.Unknown<string>(),
                    k.Number(e, "InstallationHeight", "m", x => new Length(x), false, "Height"),
                    MappingKernel.Unknown<Length>(), MappingKernel.Unknown<Length>(), MappingKernel.Unknown<string>(), MappingKernel.Unknown<string>()));
                break;
        }
    }
}
