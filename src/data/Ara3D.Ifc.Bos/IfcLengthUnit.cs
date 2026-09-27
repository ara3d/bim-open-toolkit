using Ara3D.IfcLoader;
using Ara3D.IO.StepParser;

namespace Ara3D.BimOpenSchema.IO;

/// <summary>The project's declared length unit: the LENGTHUNIT of IfcProject.UnitsInContext.</summary>
public readonly record struct IfcLengthUnit(string Name, double ToMetre)
{
    public const string NameParameter = "Ifc:LengthUnit";          // String, on the IFCPROJECT entity, group "IFCPROJECT"
    public const string ScaleParameter = "Ifc:LengthUnitToMetre";  // Number, same entity and group

    private const int ProjectUnitsInContextIndex = 8;
    private const int NamedUnitTypeIndex = 1;
    private const int SIUnitPrefixIndex = 2;
    private const int SIUnitNameIndex = 3;
    private const int ConversionBasedUnitNameIndex = 2;
    private const int ConversionBasedUnitFactorIndex = 3;
    private const int MeasureWithUnitValueIndex = 0;
    private const int MeasureWithUnitUnitIndex = 1;

    private const string LengthUnitType = "LENGTHUNIT";

    private static readonly Dictionary<string, double> SiPrefixScales = new(StringComparer.Ordinal)
    {
        ["EXA"] = 1e18,
        ["PETA"] = 1e15,
        ["TERA"] = 1e12,
        ["GIGA"] = 1e9,
        ["MEGA"] = 1e6,
        ["KILO"] = 1e3,
        ["HECTO"] = 1e2,
        ["DECA"] = 1e1,
        ["DECI"] = 1e-1,
        ["CENTI"] = 1e-2,
        ["MILLI"] = 1e-3,
        ["MICRO"] = 1e-6,
        ["NANO"] = 1e-9,
        ["PICO"] = 1e-12,
        ["FEMTO"] = 1e-15,
        ["ATTO"] = 1e-18,
    };

    /// <summary>Null when the file declares no length unit.</summary>
    public static IfcLengthUnit? Read(IfcFile file)
    {
        var project = file.EntityResolver.GetEntities().FirstOrDefault(e => e.GetEntityName() == "IFCPROJECT");
        if (project == null)
            return null;

        var unitsInContextId = project.GetId(ProjectUnitsInContextIndex);
        var unitAssignment = file.EntityResolver.GetEntityOrDefault(unitsInContextId);
        if (unitAssignment == null)
            return null;

        foreach (var unitId in unitAssignment.GetIdList(0))
        {
            var unitEntity = file.EntityResolver.GetEntityOrDefault(unitId);
            if (unitEntity == null)
                continue;
            var result = TryReadLengthUnit(file, unitEntity);
            if (result != null)
                return result;
        }

        return null;
    }

    private static IfcLengthUnit? TryReadLengthUnit(IfcFile file, IfcEntity unit)
    {
        var entityName = unit.GetEntityName();
        if (entityName == "IFCSIUNIT")
        {
            if (StripEnumMarkers(unit.GetStringOrEmpty(NamedUnitTypeIndex)) != LengthUnitType)
                return null;
            return ReadSiUnit(unit);
        }

        if (entityName == "IFCCONVERSIONBASEDUNIT" || entityName == "IFCCONVERSIONBASEDUNITWITHOFFSET")
        {
            if (StripEnumMarkers(unit.GetStringOrEmpty(NamedUnitTypeIndex)) != LengthUnitType)
                return null;

            var name = unit.GetStringOrEmpty(ConversionBasedUnitNameIndex);
            var measure = file.EntityResolver.GetEntityOrDefault(unit.GetId(ConversionBasedUnitFactorIndex));
            if (measure == null)
                return null;

            var factor = ReadNumberAttribute(measure, MeasureWithUnitValueIndex);
            var baseUnit = file.EntityResolver.GetEntityOrDefault(measure.GetId(MeasureWithUnitUnitIndex));
            var baseToMetre = baseUnit != null ? TryReadLengthUnit(file, baseUnit)?.ToMetre ?? 1.0 : 1.0;
            return new IfcLengthUnit(name, factor * baseToMetre);
        }

        return null;
    }

    private static IfcLengthUnit ReadSiUnit(IfcEntity unit)
    {
        var prefix = StripEnumMarkers(unit.GetStringOrEmpty(SIUnitPrefixIndex));
        var name = StripEnumMarkers(unit.GetStringOrEmpty(SIUnitNameIndex));
        var scale = string.IsNullOrEmpty(prefix) ? 1.0 : SiPrefixScales.GetValueOrDefault(prefix, 1.0);
        var combinedName = string.IsNullOrEmpty(prefix) ? name : prefix + name;
        return new IfcLengthUnit(combinedName, scale);
    }

    private static double ReadNumberAttribute(IfcEntity entity, int index)
    {
        var token = entity.GetAttribute(index);
        if (token.IsEntity)
        {
            var (_, inner) = token.AsSimpleEntity(entity.Document);
            token = inner;
        }

        return token.IsNumber ? token.AsNumber() : 1.0;
    }

    /// <summary>STEP enumeration values are written as e.g. ".LENGTHUNIT.". GetStringOrEmpty strips
    /// quotes but not these surrounding dots, so callers comparing against a bare enum name trim them here.</summary>
    private static string StripEnumMarkers(string value)
        => value.Trim('.');
}
