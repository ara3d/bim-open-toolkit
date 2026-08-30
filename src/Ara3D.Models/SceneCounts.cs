using System.Diagnostics;
using Ara3D.Geometry;

namespace Ara3D.Models;

public unsafe class SceneCounts
{
    public readonly int NumVertices;
    public readonly int NumIndices;
    public readonly int NumMeshes;
    public readonly int NumInstances;

    public readonly long VerticesOffset;
    public readonly long IndicesOffset;
    public readonly long MeshesOffset;
    public readonly long InstancesOffset;

    public SceneCounts(int numVertices, int numIndices, int numMeshes, int numInstances)
    {
        NumVertices = numVertices;
        NumIndices = numIndices;
        NumMeshes = numMeshes;
        NumInstances = numInstances;

        VerticesOffset = 0;
        IndicesOffset = VerticesOffset + VerticesSize;
        MeshesOffset = IndicesOffset + IndicesSize;
        InstancesOffset = MeshesOffset + MeshesSize;
        
        Debug.Assert(VerticesOffset % RequiredAlignment == 0);
        Debug.Assert(IndicesOffset % RequiredAlignment == 0);
        Debug.Assert(MeshesOffset % RequiredAlignment == 0);
        Debug.Assert(InstancesOffset % RequiredAlignment == 0);
    }

    public const int RequiredAlignment = 8;

    // Make sure that the number of bytes for indices is divisible by 8 
    public static int AlignIndexCounts(int indices)
        => indices % 2 == 1 ? indices + 1 : indices;

    public long VerticesSize => NumVertices * sizeof(Point3D);
    public long IndicesSize => AlignIndexCounts(NumIndices) * sizeof(int);
    public long InstancesSize => NumInstances * InstanceStruct.Size;
    public long MeshesSize => NumMeshes * sizeof(MeshSliceStruct);

    public long TotalSize => VerticesSize + IndicesSize + InstancesSize + MeshesSize;
}