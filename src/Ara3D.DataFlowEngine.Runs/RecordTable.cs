using System;
using System.Collections.Generic;
using Ara3D.DataTable;

namespace Ara3D.DataFlowEngine.Runs;

internal sealed record RecordDescriptor(string Name, Type Type) : IDataDescriptor;

/// <summary>An immutable in-memory column; null cells are allowed.</summary>
internal sealed class RecordColumn : IDataColumn
{
    private readonly object?[] _cells;

    public int ColumnIndex { get; }
    public IDataDescriptor Descriptor { get; }
    public int Count => _cells.Length;
    public object this[int n] => _cells[n]!;

    public RecordColumn(string name, Type type, object?[] cells, int index)
    {
        Descriptor = new RecordDescriptor(name, type);
        _cells = cells;
        ColumnIndex = index;
    }
}

internal sealed class RecordRow : IDataRow
{
    public int RowIndex { get; }
    public IDataTable DataTable { get; }
    public object this[int index] => DataTable[index, RowIndex];

    public IReadOnlyList<object> Values
    {
        get
        {
            var values = new object[DataTable.Columns.Count];
            for (var i = 0; i < values.Length; i++)
                values[i] = DataTable[i, RowIndex];
            return values;
        }
    }

    public RecordRow(IDataTable table, int rowIndex)
    {
        DataTable = table;
        RowIndex = rowIndex;
    }
}

/// <summary>Minimal immutable IDataTable backing tables parsed from run records.</summary>
internal sealed class RecordTable : IDataTable
{
    public string Name { get; }
    public IReadOnlyList<IDataColumn> Columns { get; }
    public IReadOnlyList<IDataRow> Rows { get; }
    public object this[int column, int row] => Columns[column][row];

    public RecordTable(string name, IReadOnlyList<RecordColumn> columns)
    {
        Name = name;
        Columns = columns;
        var count = columns.Count == 0 ? 0 : columns[0].Count;
        foreach (var c in columns)
            if (c.Count != count)
                throw new ArgumentException($"Column '{c.Descriptor.Name}' has {c.Count} cells, expected {count}");
        var rows = new IDataRow[count];
        for (var i = 0; i < count; i++)
            rows[i] = new RecordRow(this, i);
        Rows = rows;
    }
}
