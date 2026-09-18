namespace Ara3D.Ifc.Tests;

/// <summary>
/// Accumulates STEP entity lines of the form "#id=TYPE(attrs);" and allocates instance ids
/// sequentially, so a builder that starts from the same first id emits identical bytes every run.
/// Shared by the builders in this project.
/// </summary>
public sealed class IfcStepLines
{
    private readonly List<string> _lines = new();
    private readonly List<int> _ids = new();

    public IfcStepLines(int firstNewId)
        => NextId = firstNewId;

    public int NextId { get; set; }

    public IReadOnlyList<string> Lines
        => _lines;

    /// <summary>Every id allocated so far, in allocation order.</summary>
    public IReadOnlyList<int> Ids
        => _ids;

    /// <summary>Reserves the next id without emitting a line, for entities that reference each other.</summary>
    public int Allocate()
    {
        _ids.Add(NextId);
        return NextId++;
    }

    public void Emit(int id, string typeName, string attributes)
        => _lines.Add($"#{id}={typeName}({attributes});");

    public int Emit(string typeName, string attributes)
    {
        var id = Allocate();
        Emit(id, typeName, attributes);
        return id;
    }

    /// <summary>A quoted IfcGloballyUniqueId derived from a caller-supplied key, so reruns match.</summary>
    public static string GuidLiteral(string key)
        => IfcStepText.String(IfcGuid.Deterministic(key).ToIfcGuid());

    /// <summary>A quoted string, or the STEP "absent optional" marker.</summary>
    public static string OptionalString(string? value)
        => value == null ? "$" : IfcStepText.String(value);

    public static string Attributes(params string[] values)
        => string.Join(",", values);
}
