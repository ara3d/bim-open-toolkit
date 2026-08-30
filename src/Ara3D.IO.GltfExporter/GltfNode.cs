using System.Numerics;

namespace Ara3D.IO.GltfExporter;

/// <summary>
/// The nodes defining individual (or nested) elements in the scene
/// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy.
/// </summary>
public class GltfNode
{
    public GltfNode(Matrix4x4 mat, int meshIndex, string name = null)
    {
        SetMatrix(mat);
        mesh = meshIndex;
        this.name = name;
    }

    /// <summary>
    /// Gets or sets the user-defined name of this object.
    /// </summary>
    public string name { get; set; }

    /// <summary>
    /// Gets or sets the index of the mesh in this node.
    /// </summary>
    public int? mesh { get; set; } 

    public static List<float> ToGltfArray(Matrix4x4 m)
        => [
            // column 1
            m.M11, m.M12, m.M13, m.M14,
            // column 2
            m.M21, m.M22, m.M23, m.M24,
            // column 3
            m.M31, m.M32, m.M33, m.M34,
            // column 4
            m.M41, m.M42, m.M43, m.M44
        ];

    /// <summary>
    /// Converts from Z-up (X right, Y forward, Z up)
    /// to Y-up (X right, Y up, -Z forward/glTF-style).
    /// </summary>
    public static readonly Matrix4x4 ZUpToYUp =
        Matrix4x4.CreateRotationX(-MathF.PI / 2f);

    public static Matrix4x4 ToYUp(Matrix4x4 zUpMatrix)
        => zUpMatrix * ZUpToYUp;
    
    public void SetMatrix(Matrix4x4 m)
        => matrix = ToGltfArray(ToYUp(m)); 
    
    /// <summary>
    /// Gets or sets a floating-point 4x4 transformation matrix stored in column major order.
    /// </summary>
    public List<float> matrix { get; set; }

}