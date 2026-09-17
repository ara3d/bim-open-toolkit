namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class ColorMapTests
{
    private const double Tolerance = 1e-9;

    private static void AssertRgb(Rgb actual, Rgb expected)
    {
        Assert.That(actual.R, Is.EqualTo(expected.R).Within(Tolerance));
        Assert.That(actual.G, Is.EqualTo(expected.G).Within(Tolerance));
        Assert.That(actual.B, Is.EqualTo(expected.B).Within(Tolerance));
    }

    [Test]
    public void Viridis_EndpointsMatchFirstAndLastStops()
    {
        AssertRgb(ColorMaps.Viridis(0), ColorMaps.ViridisStops[0]);
        AssertRgb(ColorMaps.Viridis(1), ColorMaps.ViridisStops[^1]);
    }

    [Test]
    public void Viridis_MidpointMatchesMiddleStop()
        => AssertRgb(ColorMaps.Viridis(0.5), ColorMaps.ViridisStops[2]);

    [Test]
    public void Gradient_ClampsOutOfRangeAndNaN()
    {
        AssertRgb(ColorMaps.Viridis(-3), ColorMaps.ViridisStops[0]);
        AssertRgb(ColorMaps.Viridis(2), ColorMaps.ViridisStops[^1]);
        AssertRgb(ColorMaps.Viridis(double.NaN), ColorMaps.ViridisStops[0]);
    }

    [Test]
    public void RedGreen_EndpointsMatchStops()
    {
        AssertRgb(ColorMaps.RedGreen(0), ColorMaps.RedGreenStops[0]);
        AssertRgb(ColorMaps.RedGreen(1), ColorMaps.RedGreenStops[^1]);
    }

    [Test]
    public void Categorical_WrapsModuloTen()
    {
        AssertRgb(ColorMaps.Categorical(10), ColorMaps.Category10[0]);
        AssertRgb(ColorMaps.Categorical(13), ColorMaps.Category10[3]);
        AssertRgb(ColorMaps.Categorical(-1), ColorMaps.Category10[9]);
    }
}
