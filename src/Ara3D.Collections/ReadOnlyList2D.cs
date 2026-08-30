using System;
using System.Collections;
using System.Collections.Generic;

namespace Ara3D.Collections
{
    public class ReadOnlyList2D<T> : IReadOnlyList2D<T>
    {
        public int NumColumns { get; }
        public int NumRows { get; }
        public T this[int column, int row] => this[row * NumColumns + column];
        public IReadOnlyList<T> Data { get; }
        public T this[int index] => Data[index];
        public int Count => Data.Count;

        public ReadOnlyList2D(IReadOnlyList<T> data, int columns, int rows)
        {
            if (rows * columns != data.Count)
                throw new Exception($"The data array has length {data.Count} but expected {rows * columns}");
            NumRows = rows;
            NumColumns = columns;
            Data = data;
        }

        public IEnumerator<T> GetEnumerator()
            => Data.GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator()
            => GetEnumerator();
    }

    public class ReadOnlyListFunctional2D<T> : IReadOnlyList2D<T>
    {
        public int NumColumns { get; }
        public int NumRows { get; }
        public Func<int, int, T> Func { get; }
        public T this[int column, int row] => Func(column, row);
        public T this[int index] => this[index % NumColumns, index / NumColumns];
        public int Count => NumColumns * NumRows;

        public ReadOnlyListFunctional2D(int columns, int rows, Func<int, int, T> func)
        {
            NumRows = rows;
            NumColumns = columns;
            Func = func;
        }

        public IEnumerator<T> GetEnumerator()
        {
            for (var j = 0; j < NumRows; j++)
            for (var i = 0; i < NumColumns; i++)
                yield return this[i, j];
        }

        IEnumerator IEnumerable.GetEnumerator()
            => GetEnumerator();
    }

    public class ReadOnlyListAdapter2D<T> : IReadOnlyList2D<T>
    {
        public int NumColumns => Data.GetLength(0);
        public int NumRows => Data.GetLength(1);
        public T this[int column, int row] => Data[row, column];
        public T[,] Data { get; }
        public T this[int index] => Data[index % NumColumns, index / NumColumns];
        public int Count => NumColumns * NumRows;

        public ReadOnlyListAdapter2D(T[,] data)
        {
            Data = data;
        }

        public IEnumerator<T> GetEnumerator()
        {
            for (var j=0; j < NumRows; j++)
                for (var i=0; i < NumColumns; i++)
                    yield return Data[i, j];
        }

        IEnumerator IEnumerable.GetEnumerator()
            => GetEnumerator();
    }
}