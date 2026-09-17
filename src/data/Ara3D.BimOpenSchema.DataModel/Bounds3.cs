namespace Ara3D.BimOpenSchema.DataModel;

public readonly record struct Bounds3(Point3 Min, Point3 Max)
{
    public bool IsValid => Min.IsFinite && Max.IsFinite && Min.X <= Max.X && Min.Y <= Max.Y && Min.Z <= Max.Z;
    public Point3 Center => new(Min.X / 2 + Max.X / 2, Min.Y / 2 + Max.Y / 2, Min.Z / 2 + Max.Z / 2);
    public Point3 Size => new(Max.X - Min.X, Max.Y - Min.Y, Max.Z - Min.Z);
    public double Volume => Size.X * Size.Y * Size.Z;

    public bool Intersects(Bounds3 other)
        => Max.X >= other.Min.X && Min.X <= other.Max.X && Max.Y >= other.Min.Y &&
            Min.Y <= other.Max.Y && Max.Z >= other.Min.Z && Min.Z <= other.Max.Z;

    public bool Contains(Point3 point)
        => point.X >= Min.X && point.X <= Max.X && point.Y >= Min.Y && point.Y <= Max.Y && point.Z >= Min.Z && point.Z <= Max.Z;

    public bool Contains(Bounds3 other)
        => Contains(other.Min) && Contains(other.Max);

    public Bounds3 Union(Bounds3 other)
        => new(new(Math.Min(Min.X, other.Min.X), Math.Min(Min.Y, other.Min.Y), Math.Min(Min.Z, other.Min.Z)),
            new(Math.Max(Max.X, other.Max.X), Math.Max(Max.Y, other.Max.Y), Math.Max(Max.Z, other.Max.Z)));

    public double DistanceTo(Point3 point)
    {
        var x = Math.Max(0, Math.Max(Min.X - point.X, point.X - Max.X));
        var y = Math.Max(0, Math.Max(Min.Y - point.Y, point.Y - Max.Y));
        var z = Math.Max(0, Math.Max(Min.Z - point.Z, point.Z - Max.Z));
        return Math.Sqrt(x * x + y * y + z * z);
    }
}
