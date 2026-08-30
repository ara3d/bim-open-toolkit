namespace Ara3D.IO.GltfExporter;

/// <summary>
/// The json serializable glTF file format
/// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0.
/// </summary>
public class GltfData
{
    public GltfVersion asset { get; set; } = new();
    public List<GltfBuffer> buffers { get; set; } = new();
    public List<GltfBufferView> bufferViews { get; set; } = new();
    public List<GltfAccessor> accessors { get; set; } = new();
    public List<GltfScene> scenes { get; set; } = new();
    public List<GltfNode> nodes { get; set; } = new();
    public List<GltfMesh> meshes { get; set; } = new();
    public List<GltfMaterial> materials { get; set; } = new();
}