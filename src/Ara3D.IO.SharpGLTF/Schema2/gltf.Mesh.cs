using System;
using System.Collections.Generic;
using System.Linq;

using SharpGLTF.Collections;

namespace SharpGLTF.Schema2
{
    public sealed partial class Mesh
    {
        #region lifecycle

        internal Mesh()
        {
            _primitives = new ChildrenList<MeshPrimitive, Mesh>(this);
            _weights = new List<double>();
        }

        #endregion

        #region properties

        public IEnumerable<Node> VisualParents => Node.FindNodesUsingMesh(this);

        public IReadOnlyList<MeshPrimitive> Primitives => _primitives;

        public IReadOnlyList<Single> MorphWeights => GetMorphWeights();

        public bool AllPrimitivesHaveJoints => Primitives.All(p => p.GetVertexAccessor("JOINTS_0") != null);

        #endregion

        #region API

        public IReadOnlyList<Single> GetMorphWeights()
        {
            if (_weights == null || _weights.Count == 0) return Array.Empty<Single>();

            return _weights.Select(item => (float)item).ToList();
        }

        public void SetMorphWeights(IReadOnlyList<float> weights)
        {
            _weights.SetMorphWeights(weights);
        }

        public void SetMorphWeights(Transforms.SparseWeight8 weights)
        {
            int count = _primitives.Max(item => item.MorphTargetsCount);

            _weights.SetMorphWeights(count, weights);
        }
        
        /// <summary>
        /// Creates a new <see cref="MeshPrimitive"/> instance
        /// and adds it to the current <see cref="Mesh"/>.
        /// </summary>
        /// <returns>A <see cref="MeshPrimitive"/> instance.</returns>
        public MeshPrimitive CreatePrimitive()
        {
            var mp = new MeshPrimitive();

            _primitives.Add(mp);

            return mp;
        }

        #endregion
    }

    public partial class ModelRoot
    {
        /// <summary>
        /// Creates a new <see cref="Mesh"/> instance
        /// and appends it to <see cref="ModelRoot.LogicalMeshes"/>.
        /// </summary>
        /// <param name="name">The name of the instance.</param>
        /// <returns>A <see cref="Mesh"/> instance.</returns>
        public Mesh CreateMesh(string name = null)
        {
            var mesh = new Mesh();
            mesh.Name = name;

            this._meshes.Add(mesh);

            return mesh;
        }
    }
}
