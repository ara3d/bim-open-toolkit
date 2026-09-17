namespace Ara3D.BimOpenSchema.DataModel;

public readonly record struct Point3(double X, double Y, double Z)
{
    public bool IsFinite => double.IsFinite(X) && double.IsFinite(Y) && double.IsFinite(Z);
}
