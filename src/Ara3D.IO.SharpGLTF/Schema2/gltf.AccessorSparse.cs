using System.Collections.Generic;

namespace SharpGLTF.Schema2
{
    using ROOT = ModelRoot;

    public sealed partial class AccessorSparse
    {
        #region lifecycle

        internal AccessorSparse() { }

        #endregion

        #region properties

        public int Count => _count;

        #endregion

        #region API
        
        internal AccessorSparse(BufferView indices, int indicesOffset, IndexEncodingType indicesEncoding, BufferView values, int valuesOffset, int count)
        {
            this._count = count;
            this._indices = new AccessorSparseIndices(indices, indicesOffset, indicesEncoding);
            this._values = new AccessorSparseValues(values, valuesOffset);
        }

        internal KeyValuePair<Memory.IntegerArray, Memory.MemoryAccessor> _CreateMemoryAccessors(Accessor baseAccessor)
        {
            var key = this._indices._GetIndicesArray(baseAccessor.LogicalParent, _count);
            var val = this._values._GetMemoryAccessor(baseAccessor.LogicalParent, _count, baseAccessor);

            return new KeyValuePair<Memory.IntegerArray, Memory.MemoryAccessor>(key, val);
        }

        #endregion
    }

    public sealed partial class AccessorSparseIndices
    {
        #region lifecycle

        internal AccessorSparseIndices() { }

        internal AccessorSparseIndices(BufferView bv, int byteOffset, IndexEncodingType encoding)
        {
            this._bufferView = bv.LogicalIndex;
            this._byteOffset = byteOffset.AsNullable(_byteOffsetDefault);
            this._componentType = encoding;
        }

        #endregion

        #region API

        internal Memory.IntegerArray _GetIndicesArray(ROOT root, int count)
        {
            var srcBuffer = root.LogicalBufferViews[this._bufferView];
            return new Memory.IntegerArray(srcBuffer.Content, this._byteOffset ?? 0, count, this._componentType);
        }

        #endregion
    }

    public sealed partial class AccessorSparseValues
    {
        #region lifecycle

        internal AccessorSparseValues() { }

        internal AccessorSparseValues(BufferView bv, int byteOffset)
        {
            this._bufferView = bv.LogicalIndex;
            this._byteOffset = byteOffset.AsNullable(_byteOffsetDefault);
        }

        #endregion

        #region API

        internal Memory.MemoryAccessor _GetMemoryAccessor(ROOT root, int count, Accessor baseAccessor)
        {
            var view = root.LogicalBufferViews[this._bufferView];
            var info = new Memory.MemoryAccessInfo(null, this._byteOffset ?? 0, count, view.ByteStride, baseAccessor.Dimensions, baseAccessor.Encoding, baseAccessor.Normalized);
            return new Memory.MemoryAccessor(view.Content, info);
        }

        #endregion
    }
}
