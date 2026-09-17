using System.Text;

namespace Ara3D.BimOpenSchema.DataModel;

public static class TextNormalization
{
    public static string Clean(string? value)
        => string.IsNullOrWhiteSpace(value) ? "" : string.Join(" ",
            value.Normalize(NormalizationForm.FormKC).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    public static string Key(string? value)
        => Clean(value).ToUpperInvariant();

    public static string UnitKey(string? value)
        => Key(value) switch
        {
            "METERS" or "METRES" or "METER" or "METRE" or "M" => "m",
            "MILLIMETERS" or "MILLIMETRES" or "MM" => "mm",
            "CENTIMETERS" or "CENTIMETRES" or "CM" => "cm",
            "FEET" or "FOOT" or "FT" => "ft",
            "INCHES" or "INCH" or "IN" => "in",
            "M²" or "M2" => "m2",
            "M³" or "M3" => "m3",
            "FT²" or "FT2" => "ft2",
            "FT³" or "FT3" => "ft3",
            var other => other
        };

    public static (double? Value, string? Units) CanonicalNumber(double value, string units)
        => units switch
        {
            "m" => (value, "m"), "mm" => (value / 1000, "m"), "cm" => (value / 100, "m"),
            "ft" => (value * 0.3048, "m"), "in" => (value * 0.0254, "m"),
            "m2" => (value, "m2"), "ft2" => (value * 0.09290304, "m2"),
            "m3" => (value, "m3"), "ft3" => (value * 0.028316846592, "m3"),
            _ => (null, null)
        };
}
