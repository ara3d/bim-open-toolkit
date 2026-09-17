# Ara3D.BimOpenSchema.IO.Bfast

`BosBfastSerializer`: BIM Open Schema data as a BFAST buffer, for hosts that
already speak BFAST (the VIM and G3D family). Split out of
`Ara3D.BimOpenSchema.IO` because it is the only part that needs unsafe code
and the BFAST and memory packages. Keeps the `Ara3D.BimOpenSchema.IO` namespace.
