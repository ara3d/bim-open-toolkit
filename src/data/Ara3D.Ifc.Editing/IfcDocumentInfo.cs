namespace Ara3D.Ifc.Tests;

/// <summary>
/// The external document an IFC object points at: a name, where the document lives, and the
/// optional descriptive attributes IfcDocumentInformation carries.
/// </summary>
/// <param name="Name">IfcDocumentInformation.Name; required by the schema.</param>
/// <param name="Location">Where the document lives. A URI in IFC4, a free label in IFC2X3.</param>
/// <param name="Identifier">IfcDocumentInformation.Identification (DocumentId in IFC2X3), which the
/// schema requires; <see cref="Name"/> is used when it is absent.</param>
/// <param name="Format">Mime type or file extension. Emitted for IFC4 only: in IFC2X3
/// ElectronicFormat is an entity reference, which this builder does not create.</param>
/// <param name="CreationTime">ISO-8601 timestamp. Emitted for IFC4 only: in IFC2X3 CreationTime is
/// an IfcDateAndTime entity reference, which this builder does not create.</param>
public sealed record IfcDocumentInfo(
    string Name,
    string Location,
    string? Identifier = null,
    string? Description = null,
    string? Purpose = null,
    string? Format = null,
    string? CreationTime = null);
