namespace Ara3D.Ifc.Tests;

/// <summary>
/// Builds the STEP lines that associate an external document with an existing object:
/// one IfcDocumentInformation, one IfcDocumentReference, and one IfcRelAssociatesDocument.
/// Ids come from <see cref="NextId"/> and GlobalIds from a caller-supplied key, so repeated runs
/// produce identical bytes. Attribute lists follow the schema given to the constructor.
/// </summary>
public sealed class IfcDocumentReferenceBuilder
{
    public readonly int OwnerHistoryId;
    public readonly IfcSchema Schema;

    private readonly IfcStepLines _out;

    public IfcDocumentReferenceBuilder(int firstNewId, int ownerHistoryId, IfcSchema schema)
    {
        _out = new IfcStepLines(firstNewId);
        OwnerHistoryId = ownerHistoryId;
        Schema = schema;
    }

    public int NextId
    {
        get => _out.NextId;
        set => _out.NextId = value;
    }

    public IReadOnlyList<string> Lines
        => _out.Lines;

    /// <summary>Every id allocated so far, in allocation order.</summary>
    public IReadOnlyList<int> Ids
        => _out.Ids;

    public void AddDocumentReference(int relatedObjectId, IfcDocumentInfo info, string guidKey)
    {
        var infoId = _out.Allocate();
        var refId = _out.Allocate();

        _out.Emit(infoId, "IFCDOCUMENTINFORMATION",
            Schema == IfcSchema.Ifc2x3 ? DocumentInformation2x3(info, refId) : DocumentInformation4(info));
        _out.Emit(refId, "IFCDOCUMENTREFERENCE",
            Schema == IfcSchema.Ifc2x3 ? DocumentReference2x3(info) : DocumentReference4(info, infoId));

        _out.Emit("IFCRELASSOCIATESDOCUMENT", IfcStepLines.Attributes(
            IfcStepLines.GuidLiteral(guidKey + ":reldoc"),
            $"#{OwnerHistoryId}",
            IfcStepText.String(info.Name),
            IfcStepLines.OptionalString(info.Description),
            $"(#{relatedObjectId})",
            $"#{refId}"));
    }

    /// <summary>
    /// DocumentId, Name, Description, DocumentReferences, Purpose, IntendedUse, Scope, Revision,
    /// DocumentOwner, Editors, CreationTime, LastRevisionTime, ElectronicFormat, ValidFrom,
    /// ValidUntil, Confidentiality, Status. CreationTime and ElectronicFormat are entity references
    /// in IFC2X3, so they stay absent.
    /// </summary>
    private static string DocumentInformation2x3(IfcDocumentInfo info, int referenceId)
        => IfcStepLines.Attributes(
            IfcStepText.String(info.Identifier ?? info.Name),
            IfcStepText.String(info.Name),
            IfcStepLines.OptionalString(info.Description),
            $"(#{referenceId})",
            IfcStepLines.OptionalString(info.Purpose),
            "$", "$", "$", "$", "$", "$", "$", "$", "$", "$", "$", "$");

    /// <summary>
    /// Identification, Name, Description, Location, Purpose, IntendedUse, Scope, Revision,
    /// DocumentOwner, Editors, CreationTime, LastRevisionTime, ElectronicFormat, ValidFrom,
    /// ValidUntil, Confidentiality, Status.
    /// </summary>
    private static string DocumentInformation4(IfcDocumentInfo info)
        => IfcStepLines.Attributes(
            IfcStepText.String(info.Identifier ?? info.Name),
            IfcStepText.String(info.Name),
            IfcStepLines.OptionalString(info.Description),
            IfcStepText.String(info.Location),
            IfcStepLines.OptionalString(info.Purpose),
            "$", "$", "$", "$", "$",
            IfcStepLines.OptionalString(info.CreationTime),
            "$",
            IfcStepLines.OptionalString(info.Format),
            "$", "$", "$", "$");

    /// <summary>
    /// Location, ItemReference, Name. Name must stay absent: WR1 requires exactly one of Name and
    /// the inverse ReferenceToDocument, which the IfcDocumentInformation above supplies.
    /// </summary>
    private static string DocumentReference2x3(IfcDocumentInfo info)
        => IfcStepLines.Attributes(
            IfcStepText.String(info.Location),
            IfcStepLines.OptionalString(info.Identifier),
            "$");

    /// <summary>
    /// Location, Identification, Name, Description, ReferencedDocument. Name stays absent for the
    /// same reason as in IFC2X3, here because ReferencedDocument is set.
    /// </summary>
    private static string DocumentReference4(IfcDocumentInfo info, int informationId)
        => IfcStepLines.Attributes(
            IfcStepText.String(info.Location),
            IfcStepLines.OptionalString(info.Identifier),
            "$",
            IfcStepLines.OptionalString(info.Description),
            $"#{informationId}");
}
