using Ara3D.Utils;

namespace Ara3D.PropKit;

/// <summary>
/// A class that combines a property descriptor with functions for retrieving or values.
/// </summary>
public class PropAccessor<TTarget, TValue>
    : IPropAccessor<TTarget, TValue>
{
    public PropAccessor(PropDescriptor descriptor, Delegate getter, Delegate? setter = null)
    {
        Descriptor = descriptor;
        Getter = (Getter<TTarget, TValue>)getter;
        Setter = (Setter<TTarget, TValue>)setter;
    }

    public PropDescriptor Descriptor { get; }
    public Getter<TTarget, TValue> Getter { get; }
    public Setter<TTarget, TValue> Setter { get; }
    public bool HasSetter => Setter != null;

    public object GetValue(object host)
        => GetValue((TTarget)host);

    public void SetValue(ref object host, object value)
    {
        if (Descriptor.IsReadOnly)
            throw new Exception("Read only accessor");
        if (Setter == null)
            throw new Exception("No setter provided");
        var validatedObj = Descriptor.Validate(value);   
        if (typeof(TTarget).IsValueType)
        {
            var t = (TTarget)host;
            Setter(ref t, (TValue)validatedObj);
            host = t!;
        }
        else
        {
            var t = (TTarget)host;
            Setter(ref t, (TValue)validatedObj);
        }
    }

    public TValue GetValue(TTarget host) 
        => Getter(host);

    public void SetValue(ref TTarget host, object value)
        => SetValue(ref host, (TValue)value);

    public void SetValue(ref TTarget host, TValue value)
    {
        if (Descriptor.IsReadOnly)
            throw new Exception("Read only accessor");
        if (Setter == null)
            throw new Exception("No setter provided");
        Setter(ref host, (TValue)Descriptor.Validate(value));
    }

    object IPropAccessor<TTarget>.GetValue(TTarget host)
        => GetValue(host);
}

public interface IPropAccessor
{
    PropDescriptor Descriptor { get; }
    bool HasSetter { get; }
    object GetValue(object host);
    void SetValue(ref object host, object value);
}

public interface IPropAccessor<TTarget>
    : IPropAccessor
{
    object GetValue(TTarget host);
    void SetValue(ref TTarget host, object value);
}

public interface IPropAccessor<TTarget, TValue>
    : IPropAccessor<TTarget>
{
    TValue GetValue(TTarget host);
    void SetValue(ref TTarget host, TValue value);
}

public static class PropAccessorExtensions
{
    public static PropValue GetPropValue(this IPropAccessor self, object host)
        => new(self.GetValue(host), self.Descriptor);

    public static void SetPropValue(this IPropAccessor self, ref object host, PropValue propValue)
    {
        if (propValue.Descriptor != self.Descriptor)
            throw new Exception("Incorrect descriptor");
        self.SetValue(ref host, propValue.Value);
    }
}
