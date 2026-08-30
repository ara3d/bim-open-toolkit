using Ara3D.Geometry;
using Ara3D.Memory;

namespace Ara3D.Models;

public sealed class MeshAdapter : IDisposable
{
    public IMemoryOwner? IndexData { get; private set; }
    public IMemoryOwner? PointData { get; private set; }
    public TriangleMesh3D Mesh { get; }

    public MeshAdapter(IMemoryOwner pointData, IMemoryOwner indexData)
    {   
        PointData = pointData;
        IndexData = indexData;
        var points = BufferExtensions.Reinterpret<Point3D>(PointData);
        var indices = BufferExtensions.Reinterpret<Integer3>(IndexData);
        Mesh = new TriangleMesh3D(points, indices);
    }

    public void Dispose()
    {
        PointData?.Dispose();
        IndexData?.Dispose();
        PointData = null;
        IndexData = null;
    }
}