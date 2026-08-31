using System.Text;
using Ara3D.Utils;
using DuckDB.NET.Data;

namespace Ara3D.BimOpenSchema.DuckDb;

/// <summary>Adds the views that make the database answerable. BIM Open Schema interns every
/// string and every enum, so the raw tables are almost entirely integer indexes: a query
/// against <c>Entities</c> alone can see no names at all. Each view resolves those indexes by
/// joining on <c>rowid</c>, which is the order the BOS arrays were written in.</summary>
public static class BosDuckDbViews
{
    public static void CreateViews(FilePath database)
    {
        using var conn = BosDuckDb.Open(database);
        conn.CreateViews();
    }

    public static void CreateViews(this DuckDBConnection conn)
    {
        conn.Execute("""
            CREATE OR REPLACE VIEW EntityText AS
            SELECT e.rowid AS EntityIndex, e.LocalId AS StepId, sg.Strings AS GlobalId,
                   sn.Strings AS Name, sc.Strings AS Category, st.Strings AS Type
            FROM Entities e
            LEFT JOIN Strings sg ON sg.rowid = e.GlobalId
            LEFT JOIN Strings sn ON sn.rowid = e.Name
            LEFT JOIN Entities ec ON ec.rowid = e.Category
            LEFT JOIN Strings sc ON sc.rowid = ec.Name
            LEFT JOIN Entities et ON et.rowid = e.Type
            LEFT JOIN Strings st ON st.rowid = et.Name
            """);

        conn.Execute($"""
            CREATE OR REPLACE VIEW ParameterText AS
            SELECT p.Entity AS EntityIndex, dn.Strings AS Name, dg.Strings AS ParameterGroup,
                   du.Strings AS Units, {EnumCase("d.Type", Enum.GetValues<ParameterType>())} AS ValueType,
                   CASE d.Type
                       WHEN {(int)ParameterType.String} THEN sv.Strings
                       WHEN {(int)ParameterType.Number} THEN CAST(nv.Numbers AS VARCHAR)
                       WHEN {(int)ParameterType.Entity} THEN ev.Strings
                       ELSE CAST(p.Value AS VARCHAR)
                   END AS Value
            FROM Parameters p
            JOIN Descriptors d ON d.rowid = p.Descriptor
            LEFT JOIN Strings dn ON dn.rowid = d.Name
            LEFT JOIN Strings dg ON dg.rowid = d."Group"
            LEFT JOIN Strings du ON du.rowid = d.Units
            LEFT JOIN Strings sv ON sv.rowid = p.Value
            LEFT JOIN Numbers nv ON nv.rowid = p.Value
            LEFT JOIN Entities ee ON ee.rowid = p.Value
            LEFT JOIN Strings ev ON ev.rowid = ee.Name
            """);

        conn.Execute($"""
            CREATE OR REPLACE VIEW RelationText AS
            SELECT r.EntityA AS EntityIndexA, an.Strings AS NameA,
                   r.EntityB AS EntityIndexB, bn.Strings AS NameB,
                   {EnumCase("r.RelationType", Enum.GetValues<RelationType>())} AS RelationType
            FROM Relations r
            LEFT JOIN Entities ea ON ea.rowid = r.EntityA
            LEFT JOIN Strings an ON an.rowid = ea.Name
            LEFT JOIN Entities eb ON eb.rowid = r.EntityB
            LEFT JOIN Strings bn ON bn.rowid = eb.Name
            """);
    }

    private static string EnumCase<T>(string column, IReadOnlyList<T> values) where T : struct, Enum
    {
        var sb = new StringBuilder("CASE ").Append(column);
        var seen = new HashSet<int>();
        foreach (var value in values)
        {
            var number = Convert.ToInt32(value);
            if (seen.Add(number))
                sb.Append($" WHEN {number} THEN '{value}'");
        }

        return sb.Append(" END").ToString();
    }
}
