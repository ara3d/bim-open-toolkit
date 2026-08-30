using System;
using System.Collections.Generic;
using System.Linq;
using Ara3D.Collections;

namespace Ara3D.BimOpenSchema;

public static class BimObjectModelExtensions
{
    public static IReadOnlyList<(string LevelName, float Elevation)> GetDistinctLevels(this BimObjectModel self)
    {
        var tmp = self.Entities.Select(e => (e.LevelName, e.Elevation)).Distinct().OrderBy(pair => pair.Elevation).ToList();

        if (tmp.Count == 0) return tmp;

        var prev = tmp[0];
        var r = new List<(string LevelName, float Elevation)>() { prev };
        for (var i = 1; i < tmp.Count; i++)
        {
            var cur = tmp[i];
            // TODO: this is a hack.
            const double levelDiff = 0.001;
            if (cur.LevelName != prev.LevelName || Math.Abs(cur.Elevation - prev.Elevation) > levelDiff)
            {
                r.Add(cur);
                prev = cur;
            }
        }

        return r;
    }
}