# Ara3D.Studio.BimTools

Ara 3D Studio scripts that read BIM Open Schema data: category, level, and
parameter filters, room and door tools, door clearance, daylight voxels, wall
plan diagrams, and the room navigator overlay. Each file is a self-contained
Studio tool, the same contract as the general examples in the SDK's
`examples/Ara3D.Studio.Examples`, which this project references for the shared
`Cat` menu labels and global usings.

The files keep their original namespaces (`Ara3D.Studio.Samples.BIM_Tools`,
`Ara3D.Studio.Tools`) so scripts that reference them keep working.
`Lakehouse/` and the two `SimulateSequence` demos are excluded from
compilation, as they were in the SDK.
