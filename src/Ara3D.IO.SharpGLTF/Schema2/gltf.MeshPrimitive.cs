using System;
using System.Collections.Generic;
using System.Linq;

using SharpGLTF.Collections;

namespace SharpGLTF.Schema2
{
    public sealed partial class MeshPrimitive : IChildOfList<Mesh>
    {
        #region lifecycle

        internal MeshPrimitive()
        {
            _attributes = new Dictionary<string, int>();
            _targets = new List<Dictionary<string, int>>();
        }

        #endregion

        #region properties

        /// <summary>
        /// Gets the zero-based index of this <see cref="MeshPrimitive"/> at <see cref="Mesh.Primitives"/>.
        /// </summary>
        public int LogicalIndex { get; private set; } = -1;

        /// <summary>
        /// Gets the <see cref="Mesh"/> instance that owns this <see cref="MeshPrimitive"/> instance.
        /// </summary>
        public Mesh LogicalParent { get; private set; }

        void IChildOfList<Mesh>.SetLogicalParent(Mesh parent, int index)
        {
            LogicalParent = parent;
            LogicalIndex = index;
        }

        /// <summary>
        /// Gets or sets the <see cref="Material"/> instance, or null.
        /// </summary>
        public Material Material
        {
            get => this._material.HasValue ? LogicalParent.LogicalParent.LogicalMaterials[this._material.Value] : null;
            set
            {
                this._material = value == null ? (int?)null : value.LogicalIndex;
            }
        }

        public PrimitiveType DrawPrimitiveType
        {
            get => this._mode.AsValue(_modeDefault);
            set => this._mode = value.AsNullable(_modeDefault);
        }

        public int MorphTargetsCount => _targets.Count;

        public IReadOnlyDictionary<String, Accessor> VertexAccessors => new ReadOnlyLinqDictionary<String, int, Accessor>(_attributes, alidx => this.LogicalParent.LogicalParent.LogicalAccessors[alidx]);

        public Accessor IndexAccessor { get => GetIndexAccessor(); set => SetIndexAccessor(value); }

        #endregion

        #region API - Buffers

        public IEnumerable<BufferView> GetBufferViews(bool includeIndices, bool includeVertices, bool includeMorphs)
        {
            var accessors = new List<Accessor>();

            var attributes = this._attributes.Keys.ToArray();

            if (includeIndices)
            {
                if (IndexAccessor != null) accessors.Add(IndexAccessor);
            }

            if (includeVertices)
            {
                accessors.AddRange(attributes.Select(k => VertexAccessors[k]));
            }

            if (includeMorphs)
            {
                for (int i = 0; i < MorphTargetsCount; ++i)
                {
                    foreach (var key in attributes)
                    {
                        var morpthAccessors = GetMorphTargetAccessors(i);
                        if (morpthAccessors.TryGetValue(key, out Accessor accessor)) accessors.Add(accessor);
                    }
                }
            }

            var indices = accessors
                .Select(item => item._SourceBufferViewIndex)
                .Where(item => item >= 0)
                .Distinct();

            return indices.Select(idx => this.LogicalParent.LogicalParent.LogicalBufferViews[idx]);
        }

        public IReadOnlyList<KeyValuePair<String, Accessor>> GetVertexAccessorsByBuffer(BufferView vb)
        {
            return VertexAccessors
                .Where(key => key.Value.SourceBufferView == vb)
                .OrderBy(item => item.Value.ByteOffset)
                .ToArray();
        }

        #endregion

        #region API - Vertices

        public Accessor GetVertexAccessor(string attributeKey)
        {
            if (!_attributes.TryGetValue(attributeKey, out int idx)) return null;

            return this.LogicalParent.LogicalParent.LogicalAccessors[idx];
        }

        public void SetVertexAccessor(string attributeKey, Accessor accessor)
        {
            if (accessor != null)
            {
                _attributes[attributeKey] = accessor.LogicalIndex;
            }
            else
            {
                _attributes.Remove(attributeKey);
            }
        }

        public Memory.MemoryAccessor GetVertices(string attributeKey)
        {
            return GetVertexAccessor(attributeKey)._GetMemoryAccessor(attributeKey);
        }

        #endregion

        #region API - Indices

        public Accessor GetIndexAccessor()
        {
            if (!this._indices.HasValue) return null;

            return this.LogicalParent.LogicalParent.LogicalAccessors[this._indices.Value];
        }

        public void SetIndexAccessor(Accessor accessor)
        {
            if (accessor == null) { this._indices = null; return; }

            this._indices = accessor.LogicalIndex;
        }

        /// <summary>
        /// Gets the raw list of indices of this primitive.
        /// </summary>
        /// <returns>A list of indices, or null.</returns>
        public IList<UInt32> GetIndices() => IndexAccessor?.AsIndicesArray();

        /// <summary>
        /// Decodes the raw indices and returns a list of indexed points.
        /// </summary>
        /// <returns>A sequence of indexed points.</returns>
        public IEnumerable<int> GetPointIndices()
        {
            if (this.DrawPrimitiveType.GetPrimitiveVertexSize() != 1) return Enumerable.Empty<int>();

            if (this.IndexAccessor == null) return Enumerable.Range(0, VertexAccessors.Values.First().Count);

            return this.IndexAccessor.AsIndicesArray().Select(item => (int)item);
        }

        /// <summary>
        /// Decodes the raw indices and returns a list of indexed lines.
        /// </summary>
        /// <returns>A sequence of indexed lines.</returns>
        public IEnumerable<(int A, int B)> GetLineIndices()
        {
            if (this.DrawPrimitiveType.GetPrimitiveVertexSize() != 2) return Enumerable.Empty<(int, int)>();

            if (this.IndexAccessor == null) return this.DrawPrimitiveType.GetLinesIndices(VertexAccessors.Values.First().Count);

            return this.DrawPrimitiveType.GetLinesIndices(this.IndexAccessor.AsIndicesArray());
        }

        /// <summary>
        /// Decodes the raw indices and returns a list of indexed triangles.
        /// </summary>
        /// <returns>A sequence of indexed triangles.</returns>
        public IEnumerable<(int A, int B, int C)> GetTriangleIndices()
        {
            if (this.DrawPrimitiveType.GetPrimitiveVertexSize() != 3) return Enumerable.Empty<(int, int, int)>();

            if (this.IndexAccessor == null) return this.DrawPrimitiveType.GetTrianglesIndices(VertexAccessors.Values.First().Count);

            return this.DrawPrimitiveType.GetTrianglesIndices(this.IndexAccessor.AsIndicesArray());
        }

        #endregion

        #region API - Morph Targets

        public IReadOnlyDictionary<String, Accessor> GetMorphTargetAccessors(int targetIdx)
        {
            return new ReadOnlyLinqDictionary<String, int, Accessor>(_targets[targetIdx], alidx => this.LogicalParent.LogicalParent.LogicalAccessors[alidx]);
        }

        public void SetMorphTargetAccessors(int targetIdx, IReadOnlyDictionary<String, Accessor> accessors)
        {
            while (_targets.Count <= targetIdx) _targets.Add(new Dictionary<string, int>());

            var target = _targets[targetIdx];

            target.Clear();

            foreach (var kvp in accessors)
            {
                target[kvp.Key] = kvp.Value.LogicalIndex;
            }
        }

        #endregion

        #region validation

        internal static bool CheckAttributesQuantizationRequired(ModelRoot root)
        {
            return root
                .LogicalMeshes
                .SelectMany(item => item.Primitives)
                .Any(prim => prim.CheckAttributesQuantizationRequired());
        }

        private bool CheckAttributesQuantizationRequired()
        {
            static bool _checkAccessors(IReadOnlyDictionary<string, Accessor> accessors)
            {
                foreach (var va in accessors)
                {
                    if (va.Value.Encoding == EncodingType.FLOAT) continue;

                    if (va.Key == "POSITION") return true;
                    if (va.Key == "NORMAL") return true;
                    if (va.Key == "TANGENT") return true;

                    if (va.Value.Encoding == EncodingType.UNSIGNED_BYTE) continue;
                    if (va.Value.Encoding == EncodingType.UNSIGNED_SHORT) continue;

                    if (va.Key.StartsWith("TEXCOORD_", StringComparison.OrdinalIgnoreCase)) return true;
                }

                return false;
            }

            if (_checkAccessors(this.VertexAccessors)) return true;

            for (int midx = 0; midx < this.MorphTargetsCount; ++midx)
            {
                var mt = this.GetMorphTargetAccessors(midx);

                if (_checkAccessors(mt)) return true;
            }

            return false;
        }


        #endregion
    }
}
