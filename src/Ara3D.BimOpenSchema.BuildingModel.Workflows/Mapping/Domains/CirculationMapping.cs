using System.Collections.Immutable;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Stairs, flights, landings, ramps, railings, vertical transport and furniture. Wave R5 track B; see WAVE-R5.md.</summary>
public static class CirculationMapping
{
    public static readonly DomainMapping Domain = new("Circulation",
    [
        new("Stairs", "Stair"), new("Multistory Stairs", "Stair"), new("IFCSTAIR", "Stair"), new("Treppen", "Stair"),
        new("Runs", "StairFlight"), new("IFCSTAIRFLIGHT", "StairFlight"),
        new("Landings", "Landing"),
        new("Ramps", "Ramp"), new("IFCRAMP", "Ramp"),
        new("Railings", "Railing"), new("Handrails", "Railing"), new("Top Rails", "Railing"), new("IFCRAILING", "Railing"),
        new("IFCTRANSPORTELEMENT", "VerticalTransport"),
        new("Furniture", "Furniture"), new("Casework", "Furniture"), new("Furniture Systems", "Furniture"),
        new("IFCFURNITURE", "Furniture"), new("IFCFURNISHINGELEMENT", "Furniture"), new("IFCSYSTEMFURNITUREELEMENT", "Furniture"), new("Möbel", "Furniture")
    ],
    ["Construction", "Materials and Finishes", "Pset_StairCommon", "Pset_StairFlightCommon", "Pset_RailingCommon", "Pset_RampCommon"],
    Map, Complete);

    private static void Map(MappingKernel k, EntityRow e, string kind, ProjectionBuilder b)
    {
        var element = k.Element(e);
        switch (kind)
        {
            case "Stair":
                b.Add(new Stair(k.Key<Stair>(e), element, k.Assembly(e),
                    k.Reference<Storey>(e, "LowerStorey", "Base Level", "Reference Level", "Basisebene"),
                    k.Reference<Storey>(e, "UpperStorey", "Top Level"),
                    MappingKernel.Unknown<Length>(),
                    k.Number(e, "TotalRise", "m", x => new Length(x), false, "Desired Stair Height", "Gewünschte Treppenhöhe"),
                    k.Flag(e, "IsExternal", "IsExternal"),
                    LinkSet<StairFlight>.Unknown(), LinkSet<Landing>.Unknown(), LinkSet<Railing>.Unknown()));
                break;
            case "StairFlight":
                b.Add(new StairFlight(k.Key<StairFlight>(e), element,
                    k.Reference<Stair>(e, "Stair", "Stair", "Host"), MappingKernel.Unknown<int>(),
                    k.Reference<Landing>(e, "LowerLanding", "Lower Landing"), k.Reference<Landing>(e, "UpperLanding", "Upper Landing"),
                    k.Integer(e, "RiserCount", "Actual Number of Risers", "NumberOfRiser"),
                    k.Number(e, "NominalRiserHeight", "m", x => new Length(x), false, "Actual Riser Height", "RiserHeight"),
                    k.Number(e, "NominalTreadGoing", "m", x => new Length(x), false, "Actual Tread Depth", "TreadLength"),
                    k.Number(e, "MinimumClearWidth", "m", x => new Length(x), false, "Actual Run Width"),
                    MappingKernel.Unknown<Length>()));
                break;
            case "Landing":
                b.Add(new Landing(k.Key<Landing>(e), element,
                    k.Reference<Stair>(e, "Stair", "Stair", "Host"), k.Reference<Ramp>(e, "Ramp", "Ramp"),
                    element.Location.PrimaryStorey,
                    k.Number(e, "ClearWidth", "m", x => new Length(x), false, "Clear Width"),
                    k.Number(e, "ClearDepth", "m", x => new Length(x), false, "Clear Depth"),
                    MappingKernel.Unknown<Area>(),
                    k.Assembly(e), LinkSet<Railing>.Unknown()));
                // A landing's plan "Area" does not state the net basis the field asks for.
                k.DiagnoseUnspecifiedQuantity(e, "NetArea", "Area", "Fläche");
                break;
            case "Ramp":
                b.Add(new Ramp(k.Key<Ramp>(e), element, k.Assembly(e),
                    k.Reference<Storey>(e, "LowerStorey", "Base Level"), k.Reference<Storey>(e, "UpperStorey", "Top Level"),
                    MappingKernel.Unknown<Length>(), MappingKernel.Unknown<Length>(),
                    MappingKernel.Unknown<Ratio>(), MappingKernel.Unknown<Ratio>(),
                    k.Number(e, "MinimumClearWidth", "m", x => new Length(x), false, "Width"),
                    LinkSet<Landing>.Unknown(), LinkSet<Railing>.Unknown(), MappingKernel.Unknown<string>()));
                if (k.Rows(e).Any(p => TextNormalization.Key(p.Name) == "RAMP MAX SLOPE (1/X)"))
                    k.Diagnose("quantity.unspecified-basis", e, "MaximumLongitudinalSlope",
                        "Ramp Max Slope (1/x) is an inverse slope ratio in unestablished display units; not converted without an inference.");
                break;
            case "Railing":
                b.Add(new Railing(k.Key<Railing>(e), element, k.Product(e), k.Object(e, "Host", "Host", "Host Id"),
                    MappingKernel.Unknown<string>(),
                    k.Number(e, "PathLength", "m", x => new Length(x), false, "Length"),
                    k.Number(e, "Height", "m", x => new Length(x), false, "Railing Height", "Height"),
                    MappingKernel.Unknown<Length>(), MappingKernel.Unknown<ReferenceKey<Material>>(),
                    k.Text(e, "Finish", "Finish")));
                break;
            case "VerticalTransport":
                b.Add(new VerticalTransport(k.Key<VerticalTransport>(e), element,
                    MappingKernel.Unknown<VerticalTransportRole>(), k.Product(e),
                    LinkSet<Storey>.Unknown(), MappingKernel.Unknown<Mass>(), MappingKernel.Unknown<int>(),
                    MappingKernel.Unknown<Length>(), MappingKernel.Unknown<Length>(), MappingKernel.Unknown<Length>(),
                    MappingKernel.Unknown<Length>(), MappingKernel.Unknown<Length>(),
                    LinkSet<Door>.Unknown(), MappingKernel.Unknown<string>()));
                break;
            case "Furniture":
                b.Add(new Furniture(k.Key<Furniture>(e), element, k.Product(e),
                    k.Reference<Space>(e, "Space", "Room", "Space", "Rvt:FamilyInstance:Room", "Rvt:FamilyInstance:Space"),
                    MappingKernel.Unknown<string>(), MappingKernel.Unknown<bool>(),
                    k.Number(e, "Width", "m", x => new Length(x), false, "Width"),
                    k.Number(e, "Depth", "m", x => new Length(x), false, "Depth"),
                    k.Number(e, "Height", "m", x => new Length(x), false, "Height"),
                    k.Integer(e, "SeatCount", "Chairs", "Seat Count"),
                    k.Text(e, "Finish", "Finish")));
                break;
        }
    }

    // Flights, landings and railings back-link to their stair once every row of both tables exists, the way CoreMapping
    // links storeys to spaces. Each link set carries the identity evidence of the rows that produced it, and an empty
    // one is NotObserved: Partial would claim members were seen.
    private static void Complete(MappingKernel k, ProjectionBuilder b)
    {
        var flights = Group(b.Rows<StairFlight>(), f => f.Stair, f => f.Id, f => f.Element);
        var landings = Group(b.Rows<Landing>(), l => l.Stair, l => l.Id, l => l.Element);
        var railings = Group(b.Rows<Railing>(), r => r.Host, r => r.Id, r => r.Element);
        b.Update<Stair>(s => s with
        {
            Flights = Links(flights, s.Id),
            Landings = Links(landings, s.Id),
            Railings = Links(railings, s.Element.ObjectId)
        });
        b.Update<Landing>(l => l with { Railings = Links(railings, l.Element.ObjectId) });
        b.Update<Ramp>(r => r with { Railings = Links(railings, r.Element.ObjectId) });
    }

    /// <summary>The rows linking back to one owner, and the identity evidence they contribute.</summary>
    private readonly record struct Linked<T>(ImmutableArray<SnapshotKey<T>> Items, ImmutableArray<ReferenceKey<Evidence>> Evidence);

    private static Dictionary<TOwner, Linked<TRow>> Group<TSource, TOwner, TRow>(IEnumerable<TSource> rows,
        Func<TSource, Fact<TOwner>> owner, Func<TSource, SnapshotKey<TRow>> key, Func<TSource, ElementInfo> element)
        where TOwner : notnull
        => rows.Where(r => owner(r) is Fact<TOwner>.Known).GroupBy(r => ((Fact<TOwner>.Known)owner(r)).Value)
            .ToDictionary(g => g.Key, g => new Linked<TRow>(g.Select(key).ToImmutableArray(),
                g.SelectMany(r => element(r).Evidence).Distinct().ToImmutableArray()));

    private static LinkSet<TRow> Links<TOwner, TRow>(Dictionary<TOwner, Linked<TRow>> groups, TOwner owner) where TOwner : notnull
        => groups.TryGetValue(owner, out var linked) ? MappingKernel.Observed(linked.Items, linked.Evidence) : LinkSet<TRow>.Unknown();
}
