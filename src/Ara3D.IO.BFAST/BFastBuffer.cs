using System;
using Ara3D.Memory;

namespace Ara3D.IO.BFAST;

public class BFastBuffer : IDisposable
{
    public string Name { get; set; }
    public IMemoryOwner Memory { get; set; }

    public BFastBuffer(string name, IMemoryOwner memory)
    {
        Name = name;
        Memory = memory;
    }

    public void Dispose()
    {
        Memory?.Dispose();
        Memory = null;
    }
}