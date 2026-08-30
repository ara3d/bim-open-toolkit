using System.Collections.Generic;

namespace Ara3D.Utils;

public static class SortedSetExtensions
{
    public static SortedSetWithLookup<T> ToSortedSetWithLookup<T>(this IEnumerable<T> self)
        => new(self);
}