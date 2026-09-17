using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Walls, floors, ceilings, windows, openings and facade panels. Wave R5 track A; see WAVE-R5.md.</summary>
public static class EnvelopeMapping
{
    public static readonly DomainMapping Domain = new("Envelope",
    [
        new("Walls", "Wall"), new("IFCWALL", "Wall"), new("IFCWALLSTANDARDCASE", "Wall"), new("IFCCURTAINWALL", "Wall"), new("Wände", "Wall"),
        new("Floors", "Floor"), new("IFCSLAB", "Floor"), new("Geschossdecken", "Floor"),
        new("Ceilings", "Ceiling"), new("Decken", "Ceiling"),
        new("Windows", "Window"), new("IFCWINDOW", "Window"), new("Fenster", "Window"),
        new("Shaft Openings", "Opening"), new("Rectangular Straight Wall Opening", "Opening"), new("Structural opening cut", "Opening"), new("IFCOPENINGELEMENT", "Opening"),
        new("Curtain Panels", "FacadePanel"), new("IFCPLATE", "FacadePanel")
    ],
    [
        "Construction", "Structural", "IFC Parameters", "Pset_WallCommon", "Pset_CurtainWallCommon", "Pset_SlabCommon",
        "Pset_WindowCommon", "Pset_OpeningElementCommon", "Pset_PlateCommon", "Qto_WallBaseQuantities", "Qto_SlabBaseQuantities",
        "Qto_WindowBaseQuantities", "Qto_CurtainWallQuantities"
    ],
    Map);

    private static void Map(MappingKernel k, EntityRow e, string kind, ProjectionBuilder b)
    {
        var element = k.Element(e);
        switch (kind)
        {
            case "Wall":
                var function = k.Integer(e, "Function", "Function");
                var isExterior = IsExteriorFromFunction(function);
                k.Count(e, "IsExterior", isExterior);
                b.Add(new Wall(k.Key<Wall>(e), element, k.Assembly(e),
                    k.Reference<Storey>(e, "BaseStorey", "Base Constraint"), k.Reference<Storey>(e, "TopStorey", "Top Constraint"),
                    k.Number(e, "Length", "m", x => new Length(x), false, "Length"),
                    k.Number(e, "Height", "m", x => new Length(x), false, "Unconnected Height"),
                    k.Number(e, "Thickness", "m", x => new Length(x), false, "Width"),
                    k.Flag(e, "IsLoadBearing", "Structural"), isExterior, k.FireResistance(e),
                    LinkSet<Opening>.Unknown(), LinkSet<FinishSurface>.Unknown()));
                break;

            case "Floor":
                b.Add(new Floor(k.Key<Floor>(e), element, k.Assembly(e), element.Location.PrimaryStorey,
                    k.Flag(e, "IsStructural", "Structural"),
                    k.Number(e, "Thickness", "m", x => new Length(x), false, "Thickness"),
                    MappingKernel.Unknown<Area>(), MappingKernel.Unknown<Area>(), MappingKernel.Unknown<Volume>(),
                    MappingKernel.Unknown<Angle>(), LinkSet<Opening>.Unknown(), LinkSet<FinishSurface>.Unknown()));
                k.DiagnoseUnspecifiedQuantity(e, "Area", "Area", "Fläche");
                k.DiagnoseUnspecifiedQuantity(e, "Volume", "Volume", "Volumen");
                break;

            case "Ceiling":
                b.Add(new Ceiling(k.Key<Ceiling>(e), element, k.Assembly(e), element.Location.PrimaryStorey,
                    LinkSet<Space>.Unknown(), MappingKernel.Unknown<bool>(), MappingKernel.Unknown<Area>(),
                    k.Number(e, "Thickness", "m", x => new Length(x), false, "Thickness"),
                    MappingKernel.Unknown<Length>(), k.FireResistance(e), LinkSet<FinishSurface>.Unknown()));
                k.DiagnoseUnspecifiedQuantity(e, "Area", "Area", "Fläche");
                break;

            case "Window":
                b.Add(new Window(k.Key<Window>(e), element, k.Product(e), k.Reference<Opening>(e, "Opening", "Opening"),
                    element.Location.Spaces,
                    k.Number(e, "Width", "m", x => new Length(x), false, "Width"),
                    k.Number(e, "Height", "m", x => new Length(x), false, "Height"),
                    MappingKernel.Unknown<Area>(),
                    MappingKernel.Unknown<bool>(), k.Text(e, "OperationDescription", "Operation"),
                    MappingKernel.Unknown<ThermalTransmittance>(), MappingKernel.Unknown<Ratio>(), MappingKernel.Unknown<Ratio>(),
                    k.Text(e, "GlazingSpecification", "Glazing Type")));
                k.DiagnoseUnspecifiedQuantity(e, "Area", "Area", "Fläche");
                break;

            case "Opening":
                b.Add(new Opening(k.Key<Opening>(e), element, MappingKernel.Unknown<ReferenceKey<BimObject>>(),
                    k.Text(e, "Purpose", "Purpose"),
                    k.Number(e, "Width", "m", x => new Length(x), false, "Width"),
                    k.Number(e, "Height", "m", x => new Length(x), false, "Height", "Unconnected Height"),
                    k.Number(e, "Depth", "m", x => new Length(x), false, "Depth"),
                    MappingKernel.Unknown<Area>(), element.Location.Spaces, LinkSet<Door>.Unknown(), LinkSet<Window>.Unknown()));
                k.DiagnoseUnspecifiedQuantity(e, "Area", "Area", "Fläche");
                break;

            case "FacadePanel":
                b.Add(new FacadePanel(k.Key<FacadePanel>(e), element, k.Object(e, "Host", "Host Id", "Rvt:FamilyInstance:Host"), k.Product(e),
                    MappingKernel.Unknown<string>(),
                    k.Number(e, "Width", "m", x => new Length(x), false, "Width"),
                    k.Number(e, "Height", "m", x => new Length(x), false, "Height"),
                    MappingKernel.Unknown<Area>(),
                    k.Number(e, "Thickness", "m", x => new Length(x), false, "Thickness"),
                    MappingKernel.Unknown<ThermalTransmittance>(), MappingKernel.Unknown<bool>()));
                k.DiagnoseUnspecifiedQuantity(e, "Area", "Area", "Fläche");
                break;
        }
    }

    // Revit's documented WallFunction codes: 0 Interior, 1 Exterior, 2 Foundation, 3 Retaining, 4 Soffit, 5 CoreShaft.
    // The field reports an exterior enclosure function, so only code 1 asserts it and only code 0 denies it: a
    // foundation, retaining, soffit or core-shaft wall is neither, and every other code is undocumented.
    private static Fact<bool> IsExteriorFromFunction(Fact<int> function) => function switch
    {
        Fact<int>.Known { Value: 1 } known => new Fact<bool>.Known(true, Assurance.Derived, known.Evidence),
        Fact<int>.Known { Value: 0 } known => new Fact<bool>.Known(false, Assurance.Derived, known.Evidence),
        Fact<int>.Known { Value: 2 or 3 or 4 or 5 } known => Fact<bool>.Unknown(
            $"Function code {known.Value} (foundation, retaining, soffit or core shaft) states neither an exterior nor an interior enclosure function."),
        Fact<int>.Known known => Fact<bool>.Unknown($"Function code {known.Value} is outside the documented WallFunction values."),
        Fact<int>.Missing missing => new Fact<bool>.Missing(missing.Reason, "Function: " + missing.Explanation, missing.Evidence),
        _ => Fact<bool>.Unknown("Function not observed.")
    };
}
