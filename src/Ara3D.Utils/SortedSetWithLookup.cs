using System.Collections.Generic;
using System.Linq;

namespace Ara3D.Utils;

public class SortedSetWithLookup<T>
{
    private readonly List<T> _unique = [];
    private readonly IndexedSet<T> _lookup = new();

    public SortedSetWithLookup(IEnumerable<T> values)
    {
        if (values is null)
            return;

        // Materialize and sort
        var list = values.ToList();
        if (list.Count == 0)
            return;
        
        list.Sort();

        // Deduplicate adjacent items 
        _unique = new List<T>(list.Count);
        var last = list[0];
        _unique.Add(last);
        for (var i = 1; i < list.Count; i++)
        {
            var current = list[i];
            if (!current.Equals(last))
            {
                _unique.Add(current);
                last = current;
            }
        }

        _lookup = _unique.ToIndexedSet();
    }

    /// <summary>
    /// Returns the 0-based index of 'value' in the sorted set, or -1 if not found.
    /// </summary>
    public int GetIndex(T value)
        => _lookup[value];

    /// <summary>
    /// Returns a copy of the internal sorted, duplicate-free values.
    /// </summary>
    public IReadOnlyList<T> GetValues()
        => _unique;
}