using System.Runtime.InteropServices;

namespace Ara3D.Models;

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct MeshSliceStruct
{
    public int BaseVertex;
    public int VertexCount;
    public uint FirstIndex;
    public uint IndexCount;

    public override bool Equals(object? obj)
        => obj is MeshSliceStruct other && Equals(other);

    public bool Equals(MeshSliceStruct other)
        => BaseVertex == other.BaseVertex 
           && VertexCount == other.VertexCount
           && FirstIndex == other.FirstIndex 
           && IndexCount == other.IndexCount;

    public override int GetHashCode()
        => HashCode.Combine(BaseVertex, VertexCount, FirstIndex, IndexCount);
}