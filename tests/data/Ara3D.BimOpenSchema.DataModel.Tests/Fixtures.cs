using Platonic;

namespace Ara3D.BimOpenSchema.DataModel.Tests;

[Impure]
internal static class Fixtures
{
    internal static BimModel Model(BimData? data = null, ConversionOptions? options = null)
        => BimModelConverter.Convert(data ?? Data(), options).Match(m => m,
            issues => throw new AssertionException(string.Join("; ", issues.Select(i => i.Message))));

    internal static Entity Entity(long id, int name = -1, int category = -1, int type = -1)
        => new(id, (StringIndex)(-1), (DocumentIndex)0, (StringIndex)name, (EntityIndex)category, (EntityIndex)type);

    internal static BimData Data() => new()
    {
        Strings = ["Project", "Walls", "Wall type", "Wall A", " Height ", "Dimensions", "mm", "Fire rating", "O'Brien", "height", "m", "Location"],
        Documents = [new((StringIndex)0, (StringIndex)(-1))],
        Entities = [Entity(100, 1), Entity(101, 2, 0), Entity(102, 3, 0, 1)],
        Descriptors = [new((StringIndex)4, (StringIndex)6, (StringIndex)5, ParameterType.Number),
            new((StringIndex)7, (StringIndex)(-1), (StringIndex)5, ParameterType.String),
            new((StringIndex)9, (StringIndex)6, (StringIndex)5, ParameterType.Number),
            new((StringIndex)9, (StringIndex)10, (StringIndex)5, ParameterType.Number),
            new((StringIndex)11, (StringIndex)(-1), (StringIndex)5, ParameterType.Point)],
        Numbers = [3000, 4000, 3], Points = [new(1, 2, 3)],
        Parameters = [new((EntityIndex)1, (DescriptorIndex)0, 0), new((EntityIndex)1, (DescriptorIndex)1, 8),
            new((EntityIndex)2, (DescriptorIndex)2, 1), new((EntityIndex)2, (DescriptorIndex)3, 2),
            new((EntityIndex)2, (DescriptorIndex)4, 0)],
        Relations = [new((EntityIndex)2, (EntityIndex)1, RelationType.PartOf)], Geometry = Geometry()
    };

    internal static BimGeometry Geometry() => new()
    {
        VertexX = [0, 10000, 0], VertexY = [0, 0, 10000], VertexZ = [0, 0, 0], IndexBuffer = [0, 1, 2],
        MeshVertexOffset = [0], MeshIndexOffset = [0], InstanceEntityIndex = [2], InstanceMeshIndex = [0],
        InstanceTransformIndex = [0], InstanceMaterialIndex = [-1], InstanceFlags = [0],
        TransformTX = [10], TransformTY = [20], TransformTZ = [30], TransformQX = [0], TransformQY = [0],
        TransformQZ = [0], TransformQW = [1], TransformSX = [2], TransformSY = [3], TransformSZ = [1]
    };
}
