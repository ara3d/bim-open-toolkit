using System;
using System.Collections.Generic;
using System.Linq;

namespace Ara3D.IO.BFAST;

public class BFastBuffers : IDisposable
{
    public IReadOnlyList<BFastBuffer> Buffers { get; private set; }

    public BFastBuffers(IEnumerable<BFastBuffer> buffers)
        => Buffers = buffers.ToList();

    public void Dispose()
    {
        foreach (var buffer in Buffers)
            buffer.Dispose();
        Buffers = null;
    }
}