# Vendored Ara3D.SDK packages

Local copies of the general-purpose Ara3D.SDK NuGet packages this repo consumes
(utilities, geometry, data tables, models, STEP parsing, glTF export, MCP
protocol). `nuget.config` registers this folder as a package source, so the repo
builds without a publish/install round-trip against nuget.org.

These projects live in and are owned by `ara3d/ara3d-sdk` — only BIM/IFC-specific
code lives in this repo. Current packages were packed from ara3d-sdk @ 82df7322
(v1.6.1). To refresh after an SDK change: `dotnet pack` the changed projects in
ara3d-sdk with `-o <this folder>`, bump `Ara3DSdkVersion` in
`Directory.Build.props` if the version changed.
