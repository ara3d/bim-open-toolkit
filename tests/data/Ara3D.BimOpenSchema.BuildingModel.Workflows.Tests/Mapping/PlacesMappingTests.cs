namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

/// <summary>Wave R5 track D: projects, sites, buildings, zones, terrain and landscape.</summary>
[Platonic.Impure, Category("Size.Small"), Category("Source.Synthetic")]
public sealed class PlacesMappingTests
{
    // DefinitionsMapping is included so k.Product's type reference on LandscapeAsset resolves to a real
    // ProductDefinition row instead of a dangling reference; it is the supervisor-owned Track H domain, already implemented.
    private static BuildingProjection Map(MappingFixture fixture, MappingOptions? options = null)
        => BuildingMapper.Map(fixture.Model(), options ?? MappingFixture.Options(), [CoreMapping.Domain, DefinitionsMapping.Domain, PlacesMapping.Domain]);

    // Project A carries two conflicting Project Number observations; Project B is a second, distinct linked document,
    // matching Snowdon's convention that every Project Information row is its own project, never a shared building.
    private static MappingFixture BasicFixture() => new MappingFixture()
        .Document(1, "Golden Nugget", "goldennugget.rvt")
        .Entity(0, "level-a", "Level 1", "Levels")
        .Entity(1, "project-a", "Project Information", "Project Information")
        .Entity(2, "project-b", "Project Information", "Project Information", document: 1)
        .Entity(3, "site-a", "Site", "IFCSITE")
        .Entity(4, "building-a", "Building", "IFCBUILDING")
        .Entity(5, "zone-hvac", "Default", "HVAC Zones")
        .Entity(6, "zone-area", "Level 1 Gross", "Areas")
        .Entity(7, "zone-ifc", "Zone", "IFCZONE")
        .Entity(8, "terrain-a", "Grassland", "Toposolid")
        .Entity(9, "paved-a", "Planter Box", "Hardscape")
        .Entity(10, "landscape-a", "Honey-Locust", "Planting", typeId: 11)
        .Entity(11, "planting-type", "Tree - Honey-Locust", "Planting", isType: true)
        .Text(1, "Project Number", "7765328-33-A").Text(1, "Project Number", "7765328-33-F")
        .Text(1, "Client Name", "Acme Corp").Text(1, "Project Status", "Design Development")
        .Text(2, "Project Number", "7765328-33-P").Text(2, "Client Name", "Autodesk")
        .Text(3, "Project Address", "43 Market ST")
        .Text(4, "Building Name", "Tower A")
        .Reference(5, "Level", 0)
        .Text(6, "Area Type", "Exterior Area")
        .Number(8, "Elevation at Bottom", -10, units: "FEET_AND_FRACTIONAL_INCHES")
        .Number(9, "Area", 100, units: "SQUARE_FEET")
        .Number(11, "Height", 12, units: "FEET_AND_FRACTIONAL_INCHES");

    [Test]
    public void Counts_one_row_per_kind_and_validates_clean()
    {
        var p = Map(BasicFixture(), MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal));
        Assert.Multiple(() =>
        {
            Assert.That(p.Projects, Has.Length.EqualTo(2));
            Assert.That(p.Sites, Has.Length.EqualTo(1));
            Assert.That(p.Buildings, Has.Length.EqualTo(1));
            Assert.That(p.Zones, Has.Length.EqualTo(3));
            Assert.That(p.TerrainSurfaces, Has.Length.EqualTo(1));
            Assert.That(p.PavedAreas, Has.Length.EqualTo(1));
            Assert.That(p.LandscapeAssets, Has.Length.EqualTo(1));
            Assert.That(ProjectionValidation.Validate(p), Is.Empty);
        });
    }

    [Test]
    public void Numeric_fields_require_the_revit_internal_policy_to_resolve()
    {
        var declared = Map(BasicFixture());
        Assert.That(declared.TerrainSurfaces.Single().MinimumElevation, Is.TypeOf<Fact<Length>.Missing>(),
            "No canonical unit is established under the default policy.");

        var internalPolicy = Map(BasicFixture(), MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal));
        Assert.Multiple(() =>
        {
            Assert.That(((Fact<Length>.Known)internalPolicy.TerrainSurfaces.Single().MinimumElevation).Value.Metres,
                Is.EqualTo(-10 * 0.3048).Within(1e-9));
            Assert.That(((Fact<Length>.Known)internalPolicy.LandscapeAssets.Single().InstallationHeight).Value.Metres,
                Is.EqualTo(12 * 0.3048).Within(1e-9));
        });
    }

    [Test]
    public void Generic_area_never_fills_a_field_that_states_its_own_measurement_basis()
    {
        var p = Map(BasicFixture(), MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal));
        Assert.Multiple(() =>
        {
            Assert.That(p.PavedAreas.Single().NetSurfaceArea, Is.TypeOf<Fact<Area>.Missing>(),
                "Revit's computed Area is a sketch plan area, not a net paved surface.");
            Assert.That(p.PavedAreas.Single().ProjectedArea, Is.TypeOf<Fact<Area>.Missing>());
            Assert.That(p.TerrainSurfaces.Single().SurfaceArea, Is.TypeOf<Fact<Area>.Missing>());
            Assert.That(p.Sites.Single().LandArea, Is.TypeOf<Fact<Area>.Missing>());
            Assert.That(p.Diagnostics.Count(d => d.Code == "quantity.unspecified-basis" && d.Field == "Area"), Is.EqualTo(1),
                "Only the Hardscape occurrence carries an Area descriptor in this fixture.");
        });
    }

    [Test]
    public void Hvac_zone_level_reference_resolves_the_storey()
    {
        var p = Map(BasicFixture());
        var storey = p.Storeys.Single();
        var hvacZone = p.Zones.Single(z => z.Element.Name == "Default");
        Assert.That(hvacZone.Element.Location.PrimaryStorey, Is.TypeOf<Fact<SnapshotKey<Storey>>.Known>());
        Assert.That(((Fact<SnapshotKey<Storey>>.Known)hvacZone.Element.Location.PrimaryStorey).Value, Is.EqualTo(storey.Id));
    }

    [Test]
    public void Conflicting_project_number_observations_are_reported_not_guessed()
    {
        var p = Map(BasicFixture());
        var projectA = p.Projects.Single(x => x.Element.Name == "Project Information" && ((Fact<string>.Known)x.OwnerName).Value == "Acme Corp");
        Assert.That(((Fact<string>.Missing)projectA.ProjectNumber).Reason, Is.EqualTo(Availability.Conflicting));
    }

    [Test]
    public void Zone_purpose_is_fixed_by_category_and_counted()
    {
        var p = Map(BasicFixture());
        Assert.Multiple(() =>
        {
            Assert.That(((Fact<string>.Known)p.Zones.Single(z => z.Element.Name == "Default").Purpose).Value, Is.EqualTo("HVAC zone"));
            var areaZone = p.Zones.Single(z => z.Element.Name == "Level 1 Gross");
            Assert.That(((Fact<string>.Known)areaZone.Purpose).Value, Is.EqualTo("Area scheme area"));
            Assert.That(((Fact<string>.Known)areaZone.Description).Value, Is.EqualTo("Exterior Area"));
            Assert.That(((Fact<string>.Known)p.Zones.Single(z => z.Element.Name == "Zone").Purpose).Value, Is.EqualTo("IFC zone"));
            Assert.That(p.Coverage.Single(c => c.EntityKind == "Zone" && c.Field == "Purpose").Known, Is.EqualTo(3));
        });
    }

    [Test]
    public void Text_fields_resolve_from_their_declared_source_properties()
    {
        var p = Map(BasicFixture());
        Assert.Multiple(() =>
        {
            Assert.That(((Fact<string>.Known)p.Sites.Single().Address).Value, Is.EqualTo("43 Market ST"));
            Assert.That(((Fact<string>.Known)p.Buildings.Single().BuildingNumber).Value, Is.EqualTo("Tower A"));
            var projectB = p.Projects.Single(x => ((Fact<string>.Known)x.OwnerName).Value == "Autodesk");
            Assert.That(((Fact<string>.Known)projectB.ProjectNumber).Value, Is.EqualTo("7765328-33-P"));
            var projectA = p.Projects.Single(x => ((Fact<string>.Known)x.OwnerName).Value == "Acme Corp");
            Assert.That(((Fact<string>.Known)projectA.Phase).Value, Is.EqualTo("Design Development"));
        });
    }

    [Test]
    public void Landscape_asset_resolves_its_type_product_but_never_guesses_a_role_from_the_name()
    {
        var p = Map(BasicFixture());
        var asset = p.LandscapeAssets.Single();
        Assert.Multiple(() =>
        {
            Assert.That(asset.Product, Is.TypeOf<Fact<ReferenceKey<ProductDefinition>>.Known>());
            Assert.That(asset.Role, Is.TypeOf<Fact<string>.Missing>());
        });
    }

    [Test]
    public void Building_and_site_links_stay_unavailable_without_explicit_source_references()
    {
        var p = Map(BasicFixture());
        var building = p.Buildings.Single();
        var site = p.Sites.Single();
        Assert.Multiple(() =>
        {
            Assert.That(building.Project, Is.TypeOf<Fact<SnapshotKey<Project>>.Missing>());
            Assert.That(building.Site, Is.TypeOf<Fact<SnapshotKey<Site>>.Missing>());
            Assert.That(building.Storeys, Is.EqualTo(LinkSet<Storey>.Unknown()));
            Assert.That(building.Spaces, Is.EqualTo(LinkSet<Space>.Unknown()));
            Assert.That(site.Project, Is.TypeOf<Fact<SnapshotKey<Project>>.Missing>());
            Assert.That(site.Buildings, Is.EqualTo(LinkSet<Building>.Unknown()));
        });
    }

    [Test, Category("Size.Large"), Category("Source.Snowdon")]
    public void Snowdon_row_counts_match_the_source_inventory_and_stay_clean()
    {
        SnowdonSource.Require();
        var p = SnowdonSource.Projection;
        Assert.Multiple(() =>
        {
            Assert.That(p.Projects, Has.Length.EqualTo(7), "Project Information");
            Assert.That(p.Zones, Has.Length.EqualTo(108 + 7), "Areas + HVAC Zones");
            Assert.That(p.TerrainSurfaces, Has.Length.EqualTo(10), "Toposolid");
            Assert.That(p.PavedAreas, Has.Length.EqualTo(10), "Hardscape");
            Assert.That(p.LandscapeAssets, Has.Length.EqualTo(117), "Planting");
            Assert.That(p.TerrainSurfaces.Where(t => t.SurfaceArea is Fact<Area>.Known), Is.Empty, "Toposolid Area is a plan area.");
            Assert.That(p.PavedAreas.Where(a => a.NetSurfaceArea is Fact<Area>.Known), Is.Empty, "Hardscape Area is a plan area.");
            Assert.That(ProjectionFindings.Validation(p, typeof(Project), typeof(Site), typeof(Building), typeof(Zone),
                typeof(TerrainSurface), typeof(PavedArea), typeof(LandscapeAsset)), Is.Empty);
        });
    }
}
